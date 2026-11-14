import type {
  Action, Block, BlockState, Condition, Project, Slide, Trigger, VariableValue
} from '../schema/types';
import { SELF_TARGET } from '../schema/types';
import type { CompactResume, InteractionDetail, ResumeData, TrackingEvent } from '../tracking/adapter';
import { isCompact } from '../tracking/adapter';
import { completionNeedsPass, gradedBlockIds, passingScoreOf } from './scoring';

// Trigger engine v1: deliberately thin per the brief.
// Events: onClick / onSlideLoad / onVariableChange.
// Conditions: variable equality (AND of all conditions).
// Actions: show/hide layer, show/hide block, go to slide, set variable.
// v2 additions: comparison operators, adjustVariable / completeCourse /
// setScore actions, semantic tracking events (the runtime does not know
// what SCORM is - adapters translate), completion model, resume state.
// Still no compound logic and no JS-execute. Depth guard stops loops.

const MAX_DEPTH = 25;

// Blocks including group children (groups nest their blocks in props).
function walk(blocks: Block[]): Block[] {
  return blocks.flatMap((b) =>
    b.type === 'group' ? [b, ...walk((b.props as { blocks: Block[] }).blocks)] : [b]
  );
}

export interface RuntimeSnapshot {
  slideId: string;
  layerVisible: Record<string, boolean>;
  blockVisible: Record<string, boolean>; // absent = default (visible)
  variables: Record<string, VariableValue>; // by variable id
}

export interface ResumeState {
  slideId: string;
  variables: Record<string, VariableValue>; // by variable NAME (stable across edits)
  viewedSlideIds: string[];
  score?: number;
  answers?: Record<string, boolean>;
  attempts?: Record<string, number>;
}

export class Runtime {
  readonly project: Project;
  private snapshot: RuntimeSnapshot;
  private listeners = new Set<() => void>();
  private version = 0;
  private trackers = new Set<(e: TrackingEvent) => void>();
  // Events fired before any tracker subscribes (the constructor enters the
  // first slide, which can even complete a one-slide course) are buffered
  // and flushed to the first subscriber so nothing is lost.
  private pendingEvents: TrackingEvent[] = [];
  private viewedSlideIds = new Set<string>();
  private blockStates: Record<string, BlockState> = {};
  private playerButtons = { next: true, back: true, submit: true };
  private completed = false;
  private lastScore = 0;
  // True once any score has been recorded (0 is a legitimate score, so
  // lastScore alone can't say whether one exists).
  private scoreSet = false;
  // Latest result per graded block: a retry replaces the earlier answer.
  private answers: Record<string, boolean> = {};
  private gradedIds: string[] | null = null;
  private attempts: Record<string, number> = {};
  private slideEnteredAt = Date.now();
  // The slides a learner steps through, in order: question banks drawn and
  // shuffled, lightbox slides left out. Everything that counts or moves
  // through slides (Next/Back, menu, progress, completion, score) uses this.
  private lightboxId: string | null = null;
  private order: string[] = [];
  private bankDraw: string[][] = [];

  // Storyline-style built-in references, readable from text as %Name%
  // (alongside project variables by their names). Kept as a method so text
  // re-renders pick up live values on every runtime change.
  resolveReference(name: string): string | null {
    const slide = this.currentSlide();
    const idx = this.slidePosition(slide.id);
    switch (name) {
      case 'CurrentSlide':
      case 'SlideNumber': return String(idx + 1);
      case 'TotalSlides': return String(this.order.length);
      case 'SlideName': return slide.name;
      case 'CourseName':
      case 'ProjectName': return this.project.title;
      case 'ProgressPercent': return String(Math.round(((idx + 1) / Math.max(1, this.order.length)) * 100));
      case 'ViewedSlides': return String(this.viewedSlideIds.size);
      case 'Score':
      case 'ScorePercent': return String(this.lastScore);
      case 'Date': return new Date().toLocaleDateString();
      case 'Time': return new Date().toLocaleTimeString();
      case 'RandomNumber': return String(1 + Math.floor(Math.random() * 100));
      default: {
        const v = this.project.variables.find((vr) => vr.name === name);
        if (!v) return null;
        return String(this.snapshot.variables[v.id] ?? v.defaultValue);
      }
    }
  }

  // Replace %Reference% tokens in author text with live values. Unknown
  // names pass through untouched so stray percent signs stay harmless.
  substituteReferences(html: string): string {
    if (!html.includes('%')) return html;
    return html.replace(/%([A-Za-z_][\w.]*)%/g, (m, name: string) => this.resolveReference(name) ?? m);
  }

  constructor(project: Project) {
    this.project = project;
    const variables: Record<string, VariableValue> = {};
    for (const v of project.variables) variables[v.id] = v.defaultValue;
    this.rebuildOrder();
    const first = this.order[0] ?? project.slides[0].id;
    this.snapshot = {
      slideId: first,
      layerVisible: {},
      blockVisible: {},
      variables
    };
    this.enterSlide(first, 0);
  }

  // Lightbox slides ------------------------------------------------------------

  // Triggers that can fire right now: the slide's own, plus those of an open
  // lightbox slide.
  private liveTriggers(): Trigger[] {
    const lb = this.getLightbox();
    return lb ? [...this.currentSlide().triggers, ...lb.triggers] : this.currentSlide().triggers;
  }

  getLightbox(): Slide | null {
    return this.lightboxId ? this.project.slides.find((s) => s.id === this.lightboxId) ?? null : null;
  }

  // Shows a lightbox slide over the current one. Its layers and blocks start
  // from their authored state each time it opens.
  openLightbox(slideId: string, depth = 0): void {
    const lb = this.project.slides.find((s) => s.id === slideId);
    if (!lb || !lb.lightbox) return;
    const layerVisible = { ...this.snapshot.layerVisible };
    for (const layer of lb.layers) {
      layerVisible[layer.id] = layer.visibleByDefault;
      for (const b of walk(layer.blocks)) delete this.blockStates[b.id];
    }
    const blockVisible = { ...this.snapshot.blockVisible };
    for (const layer of lb.layers) for (const b of walk(layer.blocks)) delete blockVisible[b.id];
    this.snapshot = { ...this.snapshot, layerVisible, blockVisible };
    this.lightboxId = slideId;
    this.runTriggers(lb.triggers.filter((t) => t.event === 'onSlideLoad'), depth);
    this.emit();
  }

  closeLightbox(): void {
    if (!this.lightboxId) return;
    this.lightboxId = null;
    this.emit();
  }

  // Slide order and question banks ---------------------------------------------

  // Works out the order learners see. With no draw given, each bank draws at
  // random; a saved draw (from resume) is reused exactly. Bank members keep to
  // the positions the bank's slides occupy in the course: the drawn slides fill
  // the first of those positions, in order or shuffled, and the rest drop out.
  private rebuildOrder(saved?: string[][]): void {
    const project = this.project;
    const exists = new Set(project.slides.map((s) => s.id));
    const lightboxes = new Set(project.slides.filter((s) => s.lightbox).map((s) => s.id));
    const slots: (string | null)[] = project.slides.filter((s) => !s.lightbox).map((s) => s.id);
    const claimed = new Set<string>();
    const draws: string[][] = [];
    (project.banks ?? []).forEach((bank, bi) => {
      const members = bank.slideIds.filter((id) => exists.has(id) && !lightboxes.has(id) && !claimed.has(id));
      members.forEach((id) => claimed.add(id));
      let chosen: string[];
      if (saved?.[bi] && saved[bi].every((id) => members.includes(id))) {
        chosen = saved[bi];
      } else {
        const want = bank.draw > 0 && bank.draw < members.length ? bank.draw : members.length;
        const pool = [...members];
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        chosen = pool.slice(0, want);
        if (!bank.shuffle) chosen.sort((a, b) => members.indexOf(a) - members.indexOf(b));
      }
      draws.push(chosen);
      const positions = members.map((id) => slots.indexOf(id)).filter((p) => p >= 0).sort((a, b) => a - b);
      positions.forEach((p, k) => { slots[p] = chosen[k] ?? null; });
    });
    this.order = slots.filter((id): id is string => id !== null);
    if (!this.order.length) this.order = [project.slides[0].id];
    this.bankDraw = draws;
    this.gradedIds = null;
  }

  // Slides in the order a learner sees them.
  effectiveSlides(): Slide[] {
    const byId = new Map(this.project.slides.map((s) => [s.id, s]));
    return this.order.map((id) => byId.get(id)!).filter(Boolean);
  }

  // Position (0-based) of a slide in the learner's order; -1 when it isn't in it
  // (a slide left out of a bank draw, or a lightbox).
  slidePosition(slideId: string): number {
    return this.order.indexOf(slideId);
  }

  // The slide before or after one, in the learner's order. For a slide that is
  // not in the order, the nearest one by position in the course.
  neighborSlideId(slideId: string, delta: 1 | -1): string | null {
    const at = this.order.indexOf(slideId);
    if (at >= 0) return this.order[at + delta] ?? null;
    const pos = (id: string) => this.project.slides.findIndex((s) => s.id === id);
    const here = pos(slideId);
    const ids = delta === 1 ? this.order.filter((id) => pos(id) > here) : this.order.filter((id) => pos(id) < here).reverse();
    return ids[0] ?? null;
  }

  // Tracking ------------------------------------------------------------------
  // Adapters subscribe here. Events are semantic; the engine never speaks
  // SCORM, xAPI, or postMessage itself.

  onTrack = (fn: (e: TrackingEvent) => void): (() => void) => {
    this.trackers.add(fn);
    if (this.pendingEvents.length) {
      const buffered = this.pendingEvents;
      this.pendingEvents = [];
      for (const e of buffered) {
        try { fn(e); } catch (err) { console.warn('eLearnForge tracking listener failed', err); }
      }
    }
    return () => this.trackers.delete(fn);
  };

  private track(e: TrackingEvent): void {
    if (this.trackers.size === 0) {
      this.pendingEvents.push(e);
      return;
    }
    this.trackers.forEach((fn) => {
      try { fn(e); } catch (err) { console.warn('eLearnForge tracking listener failed', err); }
    });
  }

  reportInteraction(blockId: string, response: string, correct: boolean, detail?: InteractionDetail): void {
    const attempt = (this.attempts[blockId] = (this.attempts[blockId] ?? 0) + 1);
    this.track({
      type: 'interaction',
      blockId,
      response,
      correct,
      attempt,
      latencyMs: Math.max(0, Date.now() - this.slideEnteredAt),
      ...(detail ? { detail } : {})
    });
    // Question blocks read attemptsExhausted on render, so tell them.
    this.emit();
    if (this.project.completion?.autoScore) {
      this.answers[blockId] = correct;
      this.recomputeAutoScore();
    }
  }

  // How many slides the learner has seen. The player uses this to decide
  // whether late-arriving resume data is still safe to apply.
  viewedCount(): number {
    return this.viewedSlideIds.size;
  }

  // Attempt limit from Publish > Max attempts. 0 / absent = unlimited.
  maxAttempts(): number {
    const n = this.project.completion?.maxAttempts;
    return typeof n === 'number' && n > 0 ? Math.floor(n) : 0;
  }

  // True once a question has been answered as many times as allowed.
  attemptsExhausted(blockId: string): boolean {
    const max = this.maxAttempts();
    return max > 0 && (this.attempts[blockId] ?? 0) >= max;
  }

  // Score = percent of graded questions whose latest answer is correct.
  // Unanswered questions count against the learner, so the score climbs as
  // they work through the course rather than starting at 100.
  private recomputeAutoScore(): void {
    if (!this.gradedIds) this.gradedIds = gradedBlockIds(this.project, new Set(this.order));
    const total = this.gradedIds.length;
    if (total === 0) return;
    const right = this.gradedIds.filter((id) => this.answers[id]).length;
    this.applyScore(Math.round((right / total) * 100));
    this.emit();
  }

  private applyScore(raw: number): void {
    const score = Math.max(0, Math.min(100, raw));
    this.lastScore = score;
    this.scoreSet = true;
    this.track({
      type: 'scored',
      score,
      passed: score >= passingScoreOf(this.project),
      gated: completionNeedsPass(this.project)
    });
    this.checkCompletion();
  }

  // Applies the course's completion rule. Safe to call repeatedly.
  private checkCompletion(): void {
    if (this.completed) return;
    const mode = this.project.completion?.mode ?? 'allSlides';
    const allViewed = this.order.every((id) => this.viewedSlideIds.has(id));
    const passed = this.scoreSet && this.lastScore >= passingScoreOf(this.project);
    if (mode === 'allSlides' && allViewed) this.completeCourse();
    else if (mode === 'passed' && passed) this.completeCourse();
    else if (mode === 'viewedAndPassed' && allViewed && passed) this.completeCourse();
  }

  completeCourse(): void {
    if (this.completed) return;
    this.completed = true;
    const gated = completionNeedsPass(this.project);
    this.track(gated
      ? { type: 'completed', passed: this.scoreSet && this.lastScore >= passingScoreOf(this.project) }
      : { type: 'completed' });
  }

  getScore(): number | null {
    return this.scoreSet ? this.lastScore : null;
  }

  isCompleted(): boolean {
    return this.completed;
  }

  getResumeState(): ResumeState {
    const byName: Record<string, VariableValue> = {};
    for (const v of this.project.variables) {
      const val = this.snapshot.variables[v.id];
      if (val !== undefined && val !== v.defaultValue) byName[v.name] = val;
    }
    return {
      slideId: this.snapshot.slideId,
      variables: byName,
      viewedSlideIds: [...this.viewedSlideIds],
      ...(this.scoreSet ? { score: this.lastScore } : {}),
      ...(Object.keys(this.answers).length ? { answers: { ...this.answers } } : {}),
      ...(Object.keys(this.attempts).length ? { attempts: { ...this.attempts } } : {})
    };
  }

  // The small, position-based form the player stores (see CompactResume).
  exportResume(): CompactResume {
    if (!this.gradedIds) this.gradedIds = gradedBlockIds(this.project, new Set(this.order));
    const slides = this.project.slides;
    const idx = slides.findIndex((s) => s.id === this.snapshot.slideId);
    const rich = this.getResumeState();
    const out: CompactResume = {
      v: 2,
      si: Math.max(0, idx),
      n: [slides.length, this.gradedIds.length],
      vw: slides.map((s) => (this.viewedSlideIds.has(s.id) ? '1' : '0')).join('')
    };
    if (this.gradedIds.length && (Object.keys(this.answers).length || Object.keys(this.attempts).length)) {
      out.an = this.gradedIds.map((id) => (id in this.answers ? (this.answers[id] ? '1' : '0') : '-')).join('');
      out.at = this.gradedIds.map((id) => String(Math.min(9, this.attempts[id] ?? 0))).join('');
    }
    if (this.scoreSet) out.sc = this.lastScore;
    if (this.bankDraw.length) out.bk = this.bankDraw.map((ids) => ids.map((id) => slides.findIndex((s) => s.id === id)));
    if (Object.keys(rich.variables).length) out.vr = rich.variables;
    return out;
  }

  // Accepts either stored shape; anything saved by a different version of the
  // course (different slide or question count) is applied only where it still
  // lines up.
  restoreState(input: ResumeData): void {
    let state: ResumeState;
    if (isCompact(input)) {
      const slides = this.project.slides;
      // The same questions as last time, before anything is counted.
      if (input.bk && input.bk.length === (this.project.banks?.length ?? 0) && input.n[0] === slides.length) {
        this.rebuildOrder(input.bk.map((list) => list.map((i) => slides[i]?.id).filter((id): id is string => !!id)));
      }
      if (!this.gradedIds) this.gradedIds = gradedBlockIds(this.project, new Set(this.order));
      const sameSlides = input.n[0] === slides.length;
      const sameQuestions = input.n[1] === this.gradedIds.length;
      const answers: Record<string, boolean> = {};
      const attempts: Record<string, number> = {};
      if (sameQuestions) {
        this.gradedIds.forEach((id, i) => {
          const a = input.an?.[i];
          if (a === '1' || a === '0') answers[id] = a === '1';
          const n = Number(input.at?.[i] ?? 0);
          if (n > 0) attempts[id] = n;
        });
      }
      state = {
        slideId: sameSlides ? (slides[input.si]?.id ?? '') : '',
        variables: input.vr ?? {},
        viewedSlideIds: sameSlides ? slides.filter((_, i) => input.vw[i] === '1').map((s) => s.id) : [],
        ...(typeof input.sc === 'number' ? { score: input.sc } : {}),
        answers,
        attempts
      };
    } else {
      state = input;
    }
    for (const [name, value] of Object.entries(state.variables ?? {})) {
      const v = this.project.variables.find((vr) => vr.name === name);
      if (v) this.snapshot.variables[v.id] = value;
    }
    for (const id of state.viewedSlideIds ?? []) this.viewedSlideIds.add(id);
    // Restore quietly: the LMS already holds the score it was sent.
    if (typeof state.score === 'number') { this.lastScore = state.score; this.scoreSet = true; }
    if (state.answers) this.answers = { ...state.answers };
    if (state.attempts) this.attempts = { ...state.attempts };
    if (state.slideId && this.project.slides.some((s) => s.id === state.slideId)) {
      this.enterSlide(state.slideId);
    } else {
      this.emit();
    }
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;
  getSnapshot = (): RuntimeSnapshot => this.snapshot;

  private emit(): void {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  currentSlide(): Slide {
    return this.project.slides.find((s) => s.id === this.snapshot.slideId) ?? this.project.slides[0];
  }

  isLayerVisible(layerId: string): boolean {
    return this.snapshot.layerVisible[layerId] ?? false;
  }

  isBlockVisible(blockId: string): boolean {
    return this.snapshot.blockVisible[blockId] ?? true;
  }

  variableById(id: string): VariableValue | undefined {
    return this.snapshot.variables[id];
  }

  // Public entry points -----------------------------------------------------

  enterSlide(slideId: string, depth = 0): void {
    const slide = this.project.slides.find((s) => s.id === slideId);
    if (!slide) return;
    this.lightboxId = null;
    const layerVisible: Record<string, boolean> = {};
    for (const layer of slide.layers) layerVisible[layer.id] = layer.visibleByDefault;
    this.snapshot = { ...this.snapshot, slideId, layerVisible, blockVisible: {} };
    // Block states reset on every visit (like layer visibility and button
    // gating); triggers then set them (setState / show / hide actions).
    for (const layer of slide.layers) {
      for (const b of walk(layer.blocks)) delete this.blockStates[b.id];
    }
    this.viewedSlideIds.add(slideId);
    this.slideEnteredAt = Date.now();
    // Player button gating resets on each slide visit.
    this.playerButtons = { next: true, back: true, submit: true };
    const index = Math.max(0, this.slidePosition(slideId));
    this.track({ type: 'slideViewed', slideId, index, total: this.order.length });
    this.runTriggers(slide.triggers.filter((t) => t.event === 'onSlideLoad'), depth);
    // Completion rule: allSlides (default), explicit (trigger only), or one
    // of the pass-gated modes. See checkCompletion.
    this.checkCompletion();
    this.emit();
  }

  clickBlock(blockId: string): void {
    const st = this.getBlockState(blockId);
    if (st === 'disabled' || st === 'hidden') return;
    // Storyline-style automatics: a defined 'selected' style makes clicks
    // toggle selection; otherwise a defined 'visited' style marks it.
    const block = this.findBlock(blockId);
    if (block?.stateStyles?.selected) {
      this.setBlockState(blockId, st === 'selected' ? 'normal' : 'selected');
    } else if (block?.stateStyles?.visited && st === 'normal') {
      this.setBlockState(blockId, 'visited');
    }
    const matches = this.liveTriggers().filter(
      (t) => t.event === 'onClick' && t.sourceBlockId === blockId
    );
    this.runTriggers(matches, 0);
    this.emit();
  }

  blockHasClickTrigger(blockId: string): boolean {
    return this.liveTriggers().some(
      (t) => t.event === 'onClick' && t.sourceBlockId === blockId
    );
  }

  slideVisited(slideId: string): boolean {
    return this.viewedSlideIds.has(slideId);
  }

  // Fire hover / double-click triggers for a source block.
  hoverBlock(blockId: string): void {
    const matches = this.liveTriggers().filter(
      (t) => t.event === 'onHover' && t.sourceBlockId === blockId
    );
    if (matches.length) { this.runTriggers(matches, 0); this.emit(); }
  }

  leaveBlock(blockId: string): void {
    const matches = this.liveTriggers().filter(
      (t) => t.event === 'onMouseLeave' && t.sourceBlockId === blockId
    );
    if (matches.length) { this.runTriggers(matches, 0); this.emit(); }
  }

  doubleClickBlock(blockId: string): void {
    const matches = this.liveTriggers().filter(
      (t) => t.event === 'onDoubleClick' && t.sourceBlockId === blockId
    );
    if (matches.length) { this.runTriggers(matches, 0); this.emit(); }
  }

  blockHasInteractionTrigger(blockId: string): boolean {
    return this.liveTriggers().some(
      (t) => (t.event === 'onClick' || t.event === 'onHover' || t.event === 'onMouseLeave' || t.event === 'onDoubleClick') && t.sourceBlockId === blockId
    );
  }

  setVariable(variableId: string, value: VariableValue, depth = 0): void {
    this.snapshot = {
      ...this.snapshot,
      variables: { ...this.snapshot.variables, [variableId]: value }
    };
    const slide = this.currentSlide();
    const matches = slide.triggers.filter(
      (t) => t.event === 'onVariableChange' &&
        (t.watchVariableId === undefined || t.watchVariableId === '' || t.watchVariableId === variableId)
    );
    this.runTriggers(matches, depth);
    this.emit();
  }

  // The player's clock calls this when a slide's timeline starts playing
  // (including after a restart); onTimelineStart triggers fire.
  timelineStarted(): void {
    const slide = this.currentSlide();
    const matches = slide.triggers.filter((t) => t.event === 'onTimelineStart');
    if (!matches.length) return;
    this.runTriggers(matches, 0);
    this.emit();
  }

  // The player's clock calls this once when a slide's timeline reaches its
  // end; onTimelineEnd triggers on the current slide fire.
  timelineEnded(): void {
    const slide = this.currentSlide();
    this.runTriggers(slide.triggers.filter((t) => t.event === 'onTimelineEnd'), 0);
    this.emit();
  }

  getBlockState(blockId: string): BlockState {
    return this.blockStates[blockId] ?? 'normal';
  }

  setBlockState(blockId: string, state: BlockState, depth = 0): void {
    if (this.blockStates[blockId] === state) return;
    this.blockStates[blockId] = state;
    // onStateAll triggers on the current slide: fire when every watched
    // block is in the watched state.
    const matches = this.liveTriggers().filter((t) => {
      if (t.event !== 'onStateAll' || !t.watchBlockIds?.length || !t.watchState) return false;
      return t.watchBlockIds.every((id) => this.getBlockState(id) === t.watchState);
    });
    this.runTriggers(matches, depth + 1);
    this.emit();
  }

  isPlayerButtonEnabled(button: 'next' | 'back' | 'submit'): boolean {
    return this.playerButtons[button];
  }

  // Move relative to the current slide. Stops at either end rather than
  // wrapping. Used by the next/prev trigger actions and by forge.nextSlide().
  stepSlide(delta: 1 | -1, depth = 0): void {
    const target = this.neighborSlideId(this.snapshot.slideId, delta);
    if (target) this.enterSlide(target, depth);
  }

  // The player reports a keydown. Returns true when a trigger on this slide
  // handled it, so the player can stop the browser scrolling on Space/arrows.
  keyPress(key: string): boolean {
    const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k);
    const matches = this.liveTriggers().filter(
      (t) => t.event === 'onKeyPress' && t.key !== undefined && norm(t.key) === norm(key)
    );
    if (!matches.length) return false;
    this.runTriggers(matches, 0);
    this.emit();
    return true;
  }

  submit(): void {
    const slide = this.currentSlide();
    this.runTriggers(slide.triggers.filter((t) => t.event === 'onSubmit'), 0);
    this.emit();
  }

  // The player's clock reports timeline threshold crossings each tick.
  timelineCrossings(entered: string[], animDone: string[], cues: string[] = []): void {
    if (!entered.length && !animDone.length && !cues.length) return;
    const slide = this.currentSlide();
    const fired = slide.triggers.filter(
      (t) =>
        (t.event === 'onBlockEnters' && t.sourceBlockId && entered.includes(t.sourceBlockId)) ||
        (t.event === 'onAnimationComplete' && t.sourceBlockId && animDone.includes(t.sourceBlockId)) ||
        (t.event === 'onCuePoint' && t.cueId && cues.includes(t.cueId))
    );
    if (fired.length) {
      this.runTriggers(fired, 0);
      this.emit();
    }
  }

  // Public single-condition check, shared with UI that needs to react to a
  // variable outside the trigger system (e.g. conditional player-button
  // emphasis).
  checkCondition(c: Condition): boolean {
    return this.conditionsPass([c]);
  }

  setVariableByName(name: string, value: VariableValue): void {
    const v = this.project.variables.find((vr) => vr.name === name);
    if (v) this.setVariable(v.id, value);
  }

  // Internals ----------------------------------------------------------------

  private findBlock(blockId: string) {
    for (const s of this.project.slides) {
      for (const l of s.layers) {
        const b = walk(l.blocks).find((bl) => bl.id === blockId);
        if (b) return b;
      }
    }
    return undefined;
  }

  private conditionsPass(conditions: Condition[], logic: 'and' | 'or' = 'and'): boolean {
    if (conditions.length === 0) return true;
    const test = (c: Condition): boolean => {
      // Block-state condition: "block X is (not) in state S".
      if (c.blockId) {
        const match = this.getBlockState(c.blockId) === (c.blockState ?? 'visited');
        return (c.operator ?? 'eq') === 'ne' ? !match : match;
      }
      const actual = this.snapshot.variables[c.variableId];
      const expected = c.value !== undefined ? c.value : c.equals;
      const s = (v: unknown) => String(v ?? '').toLowerCase();
      switch (c.operator ?? 'eq') {
        case 'eq': return actual === expected;
        case 'ne': return actual !== expected;
        case 'gt': return Number(actual) > Number(expected);
        case 'lt': return Number(actual) < Number(expected);
        case 'gte': return Number(actual) >= Number(expected);
        case 'lte': return Number(actual) <= Number(expected);
        case 'contains': return s(actual).includes(s(expected));
        case 'notContains': return !s(actual).includes(s(expected));
        case 'startsWith': return s(actual).startsWith(s(expected));
        case 'endsWith': return s(actual).endsWith(s(expected));
        case 'between': return Number(actual) >= Number(expected) && Number(actual) <= Number(c.value2);
        case 'isEmpty': return actual === undefined || actual === '' || actual === false;
        case 'notEmpty': return !(actual === undefined || actual === '' || actual === false);
        default: return false;
      }
    };
    return logic === 'or' ? conditions.some(test) : conditions.every(test);
  }

  private runTriggers(triggers: Trigger[], depth: number): void {
    if (depth > MAX_DEPTH) {
      console.warn('eLearnForge runtime: trigger depth cap reached, stopping.');
      return;
    }
    for (const trigger of triggers) {
      if (trigger.enabled === false) continue;
      if (!this.conditionsPass(trigger.conditions, trigger.conditionLogic ?? 'and')) continue;
      for (const action of trigger.actions) this.applyAction(action, depth + 1, trigger.sourceBlockId);
    }
  }

  private applyAction(action: Action, depth: number, sourceBlockId?: string): void {
    // Resolve the "this object" (self) target to the trigger's source block.
    // If there is no source (e.g. onSlideLoad), a self target is a harmless
    // no-op rather than an error.
    const self = (blockId: string) => (blockId === SELF_TARGET ? (sourceBlockId ?? '') : blockId);
    switch (action.type) {
      case 'showLayer':
        this.snapshot = {
          ...this.snapshot,
          layerVisible: { ...this.snapshot.layerVisible, [action.layerId]: true }
        };
        break;
      case 'hideLayer':
        this.snapshot = {
          ...this.snapshot,
          layerVisible: { ...this.snapshot.layerVisible, [action.layerId]: false }
        };
        break;
      case 'showBlock':
        this.snapshot = {
          ...this.snapshot,
          blockVisible: { ...this.snapshot.blockVisible, [self(action.blockId)]: true }
        };
        break;
      case 'hideBlock':
        this.snapshot = {
          ...this.snapshot,
          blockVisible: { ...this.snapshot.blockVisible, [self(action.blockId)]: false }
        };
        break;
      case 'goToSlide':
        this.enterSlide(action.slideId, depth);
        break;
      case 'setVariable':
        this.setVariable(action.variableId, action.value, depth);
        break;
      case 'adjustVariable': {
        const current = Number(this.snapshot.variables[action.variableId] ?? 0);
        this.setVariable(action.variableId, current + action.delta, depth);
        break;
      }
      case 'completeCourse':
        this.completeCourse();
        break;
      case 'setScore': {
        this.applyScore(action.score);
        break;
      }
      case 'openUrl':
        if (typeof window !== 'undefined') window.open(action.url, '_blank', 'noopener');
        break;
      case 'toggleBlock': {
        const id = self(action.blockId);
        const visible = this.snapshot.blockVisible[id] ?? true;
        this.snapshot = {
          ...this.snapshot,
          blockVisible: { ...this.snapshot.blockVisible, [id]: !visible }
        };
        break;
      }
      case 'setState':
        this.setBlockState(self(action.blockId), action.state, depth);
        break;
      case 'setPlayerButton':
        this.playerButtons[action.button] = action.enabled;
        break;
      case 'playAudio':
      case 'pauseAudio':
      case 'pulseBlock':
      case 'playMotion':
        // Carry a blockId; resolve "self" before handing to the Player so the
        // live-effect handler always sees a concrete id.
        this.emitEffect({ ...action, blockId: self(action.blockId) });
        break;
      case 'nextSlide':
        this.stepSlide(1, depth);
        break;
      case 'prevSlide':
        this.stepSlide(-1, depth);
        break;
      case 'restartSlide':
        // enterSlide resets layers, block states and player buttons; the
        // Player owns the clock, so it is told to rewind separately.
        this.enterSlide(this.snapshot.slideId, depth);
        this.emitEffect({ type: 'restartTimeline' });
        break;
      case 'resetBlock': {
        const id = self(action.blockId);
        const { [id]: _state, ...states } = this.blockStates;
        this.blockStates = states;
        const { [id]: _vis, ...visible } = this.snapshot.blockVisible;
        this.snapshot = { ...this.snapshot, blockVisible: visible };
        break;
      }
      case 'resetVariable': {
        const v = this.project.variables.find((vr) => vr.id === action.variableId);
        if (v) this.setVariable(v.id, v.defaultValue, depth);
        break;
      }
      case 'openLightbox':
        this.openLightbox(action.slideId, depth);
        break;
      case 'closeLightbox':
        this.closeLightbox();
        break;
      case 'executeJs':
      case 'exitCourse':
        // Both need the live page (script scope with gsap, the tracking
        // adapter, the window), which the Player owns.
        this.emitEffect(action);
        break;
      case 'pauseTimeline':
      case 'resumeTimeline':
      case 'seekTimeline':
      case 'restartTimeline':
        // These touch the live player (the clock), which the runtime doesn't
        // own - hand them to the Player.
        this.emitEffect(action);
        break;
    }
  }

  // The Player registers a handler for actions that manipulate live player
  // objects (audio playback, the timeline clock, one-shot emphasis). The
  // first slide's onSlideLoad runs inside the constructor, before the Player
  // has mounted and registered - buffer those effects and flush on register
  // so slide-1 playMotion/playAudio aren't lost.
  private effectHandler: ((action: Action) => void) | null = null;
  private pendingEffects: Action[] = [];
  private emitEffect(action: Action): void {
    if (this.effectHandler) this.effectHandler(action);
    else this.pendingEffects.push(action);
  }
  onEffect(fn: (action: Action) => void): () => void {
    this.effectHandler = fn;
    const queued = this.pendingEffects.splice(0);
    queued.forEach((a) => fn(a));
    return () => { if (this.effectHandler === fn) this.effectHandler = null; };
  }
}
