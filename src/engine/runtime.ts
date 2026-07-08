import type {
  Action, Block, BlockState, Condition, Project, Slide, Trigger, VariableValue
} from '../schema/types';
import type { TrackingEvent } from '../tracking/adapter';

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

  // Storyline-style built-in references, readable from text as %Name%
  // (alongside project variables by their names). Kept as a method so text
  // re-renders pick up live values on every runtime change.
  resolveReference(name: string): string | null {
    const slide = this.currentSlide();
    const idx = this.project.slides.findIndex((s) => s.id === slide.id);
    switch (name) {
      case 'CurrentSlide':
      case 'SlideNumber': return String(idx + 1);
      case 'TotalSlides': return String(this.project.slides.length);
      case 'SlideName': return slide.name;
      case 'CourseName':
      case 'ProjectName': return this.project.title;
      case 'ProgressPercent': return String(Math.round(((idx + 1) / this.project.slides.length) * 100));
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
    this.snapshot = {
      slideId: project.slides[0].id,
      layerVisible: {},
      blockVisible: {},
      variables
    };
    this.enterSlide(project.slides[0].id, 0);
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

  reportInteraction(blockId: string, response: string, correct: boolean): void {
    this.track({ type: 'interaction', blockId, response, correct });
  }

  completeCourse(): void {
    if (this.completed) return;
    this.completed = true;
    this.track({ type: 'completed' });
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
      viewedSlideIds: [...this.viewedSlideIds]
    };
  }

  restoreState(state: ResumeState): void {
    for (const [name, value] of Object.entries(state.variables ?? {})) {
      const v = this.project.variables.find((vr) => vr.name === name);
      if (v) this.snapshot.variables[v.id] = value;
    }
    for (const id of state.viewedSlideIds ?? []) this.viewedSlideIds.add(id);
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
    const layerVisible: Record<string, boolean> = {};
    for (const layer of slide.layers) layerVisible[layer.id] = layer.visibleByDefault;
    this.snapshot = { ...this.snapshot, slideId, layerVisible, blockVisible: {} };
    // Block states reset on every visit (like layer visibility and button
    // gating); triggers then set them (setState / show / hide actions).
    for (const layer of slide.layers) {
      for (const b of walk(layer.blocks)) delete this.blockStates[b.id];
    }
    this.viewedSlideIds.add(slideId);
    // Player button gating resets on each slide visit.
    this.playerButtons = { next: true, back: true, submit: true };
    const index = this.project.slides.findIndex((s) => s.id === slideId);
    this.track({ type: 'slideViewed', slideId, index, total: this.project.slides.length });
    this.runTriggers(slide.triggers.filter((t) => t.event === 'onSlideLoad'), depth);
    // Completion mode allSlides (the default): complete once every slide
    // has been seen. Explicit mode only completes via the trigger action.
    const mode = this.project.completion?.mode ?? 'allSlides';
    if (mode === 'allSlides' && this.viewedSlideIds.size >= this.project.slides.length) {
      this.completeCourse();
    }
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
    const slide = this.currentSlide();
    const matches = slide.triggers.filter(
      (t) => t.event === 'onClick' && t.sourceBlockId === blockId
    );
    this.runTriggers(matches, 0);
    this.emit();
  }

  blockHasClickTrigger(blockId: string): boolean {
    return this.currentSlide().triggers.some(
      (t) => t.event === 'onClick' && t.sourceBlockId === blockId
    );
  }

  slideVisited(slideId: string): boolean {
    return this.viewedSlideIds.has(slideId);
  }

  // Fire hover / double-click triggers for a source block.
  hoverBlock(blockId: string): void {
    const matches = this.currentSlide().triggers.filter(
      (t) => t.event === 'onHover' && t.sourceBlockId === blockId
    );
    if (matches.length) { this.runTriggers(matches, 0); this.emit(); }
  }

  leaveBlock(blockId: string): void {
    const matches = this.currentSlide().triggers.filter(
      (t) => t.event === 'onMouseLeave' && t.sourceBlockId === blockId
    );
    if (matches.length) { this.runTriggers(matches, 0); this.emit(); }
  }

  doubleClickBlock(blockId: string): void {
    const matches = this.currentSlide().triggers.filter(
      (t) => t.event === 'onDoubleClick' && t.sourceBlockId === blockId
    );
    if (matches.length) { this.runTriggers(matches, 0); this.emit(); }
  }

  blockHasInteractionTrigger(blockId: string): boolean {
    return this.currentSlide().triggers.some(
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
    const slide = this.currentSlide();
    const matches = slide.triggers.filter((t) => {
      if (t.event !== 'onStateAll' || !t.watchBlockIds?.length || !t.watchState) return false;
      return t.watchBlockIds.every((id) => this.getBlockState(id) === t.watchState);
    });
    this.runTriggers(matches, depth + 1);
    this.emit();
  }

  isPlayerButtonEnabled(button: 'next' | 'back' | 'submit'): boolean {
    return this.playerButtons[button];
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
      if (!this.conditionsPass(trigger.conditions, trigger.conditionLogic ?? 'and')) continue;
      for (const action of trigger.actions) this.applyAction(action, depth + 1);
    }
  }

  private applyAction(action: Action, depth: number): void {
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
          blockVisible: { ...this.snapshot.blockVisible, [action.blockId]: true }
        };
        break;
      case 'hideBlock':
        this.snapshot = {
          ...this.snapshot,
          blockVisible: { ...this.snapshot.blockVisible, [action.blockId]: false }
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
        const score = Math.max(0, Math.min(100, action.score));
        this.lastScore = score;
        this.track({ type: 'scored', score });
        break;
      }
      case 'openUrl':
        if (typeof window !== 'undefined') window.open(action.url, '_blank', 'noopener');
        break;
      case 'toggleBlock': {
        const visible = this.snapshot.blockVisible[action.blockId] ?? true;
        this.snapshot = {
          ...this.snapshot,
          blockVisible: { ...this.snapshot.blockVisible, [action.blockId]: !visible }
        };
        break;
      }
      case 'setState':
        this.setBlockState(action.blockId, action.state, depth);
        break;
      case 'setPlayerButton':
        this.playerButtons[action.button] = action.enabled;
        break;
      case 'playAudio':
      case 'pauseAudio':
      case 'pulseBlock':
      case 'pauseTimeline':
      case 'resumeTimeline':
      case 'seekTimeline':
      case 'restartTimeline':
        // These touch the live player (audio elements, the clock, transient
        // emphasis), which the runtime doesn't own - hand them to the Player.
        this.effectHandler?.(action);
        break;
    }
  }

  // The Player registers a handler for actions that manipulate live player
  // objects (audio playback, the timeline clock, one-shot emphasis).
  private effectHandler: ((action: Action) => void) | null = null;
  onEffect(fn: (action: Action) => void): () => void {
    this.effectHandler = fn;
    return () => { if (this.effectHandler === fn) this.effectHandler = null; };
  }
}
