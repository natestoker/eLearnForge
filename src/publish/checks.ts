import type { Block, Project, Slide } from '../schema/types';
import { gradedBlockIds, completionNeedsPass, passingScoreOf } from '../engine/scoring';
import { projectTriggerIssues } from '../engine/validate';
import type { TriggerIssue } from '../engine/validate';
import { encodeResume } from '../tracking/adapter';
import type { CompactResume } from '../tracking/adapter';
import { isCompressible } from './compress';

// Pre-publish checks and a size estimate, shown in the Publish dialog.
// Errors block publishing (the course would be broken); warnings do not.

export type Severity = 'error' | 'warn' | 'pass';

export interface Check {
  sev: Severity;
  title: string;
  detail?: string;
  // Where the Fix button takes the author.
  fix?: { label: string; slideId: string; blockId?: string; triggerId?: string };
  // A "Compress" button: the project path of the media file to shrink.
  compress?: { path: (string | number)[]; mime: string };
}

export interface SizePart { label: string; bytes: number; color: string }

export const SIZE_LIMIT_BYTES = 100 * 1024 * 1024;
const BIG_MEDIA_BYTES = 10 * 1024 * 1024;
const SCORM12_SUSPEND_CAP = 4096;

function walk(blocks: Block[]): Block[] {
  return blocks.flatMap((b) =>
    b.type === 'group' ? [b, ...walk((b.props as { blocks: Block[] }).blocks)] : [b]
  );
}
const slideBlocks = (s: Slide) => s.layers.flatMap((l) => walk(l.blocks));

export interface Media { kind: 'media' | 'image' | 'font'; bytes: number; slideIndex: number | null; mime: string; path: (string | number)[] }

// Every embedded file travels as a data URL inside the project JSON, so the
// size of the package is mostly the length of those strings.
export function collectMedia(project: Project): { media: Media[]; dataBytes: number } {
  const media: Media[] = [];
  let dataBytes = 0;
  const visit = (v: unknown, slideIndex: number | null, path: (string | number)[]) => {
    if (typeof v === 'string') {
      if (v.startsWith('data:')) {
        const mime = v.slice(5, v.indexOf(';') > 0 ? v.indexOf(';') : v.indexOf(',')) || 'application/octet-stream';
        const kind = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') || mime.startsWith('video/') ? 'media' : mime.includes('font') ? 'font' : 'media';
        media.push({ kind, bytes: v.length, slideIndex, mime, path });
        dataBytes += v.length;
      }
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => visit(x, slideIndex, [...path, i])); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, slideIndex, [...path, k]);
  };
  project.slides.forEach((s, i) => visit(s, i, ['slides', i]));
  for (const [k, v] of Object.entries(project)) if (k !== 'slides') visit(v, null, [k]);
  return { media, dataBytes };
}

export function sizeEstimate(project: Project, runtimeBytes: number): { parts: SizePart[]; total: number } {
  const { media, dataBytes } = collectMedia(project);
  const sum = (k: Media['kind']) => media.filter((m) => m.kind === k).reduce((a, m) => a + m.bytes, 0);
  const json = JSON.stringify(project).length;
  const parts: SizePart[] = [
    { label: 'Video and audio', bytes: sum('media'), color: '#3dd97a' },
    { label: 'Images', bytes: sum('image'), color: '#6fb3f2' },
    { label: 'Fonts', bytes: sum('font'), color: '#c79bf2' },
    { label: 'Player runtime', bytes: runtimeBytes, color: '#f2b84b' },
    { label: 'Slides and data', bytes: Math.max(0, json - dataBytes), color: '#8a919c' }
  ];
  return { parts, total: parts.reduce((a, p) => a + p.bytes, 0) };
}

export const formatBytes = (n: number): string =>
  n <= 0 ? '0 KB' : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

// Which slides a learner can get to, starting from slide 1.
function unreachableSlides(project: Project): Slide[] {
  const slides = project.slides;
  const player = project.player;
  if (player?.menu?.show && !player.menu.locked) return [];
  const idx = new Map(slides.map((s, i) => [s.id, i]));
  const seen = new Set<number>([0]);
  const queue = [0];
  const anyScript = (s: Slide) => s.triggers.some((t) => t.actions.some((a) => a.type === 'executeJs'));
  while (queue.length) {
    const i = queue.shift()!;
    const s = slides[i];
    const next: number[] = [];
    const nextBtn = s.nav?.next !== 'hide' && (s.nav?.next === 'show' || player?.next?.show !== false);
    const backBtn = s.nav?.back !== 'hide' && (s.nav?.back === 'show' || player?.back?.show !== false);
    if (nextBtn || s.timeline?.autoAdvance) next.push(i + 1);
    if (backBtn) next.push(i - 1);
    for (const t of s.triggers) for (const a of t.actions) {
      if (a.type === 'goToSlide' && idx.has(a.slideId)) next.push(idx.get(a.slideId)!);
      if (a.type === 'nextSlide') next.push(i + 1);
      if (a.type === 'prevSlide') next.push(i - 1);
    }
    // Author scripts can go anywhere; assume they do rather than cry wolf.
    if (anyScript(s)) slides.forEach((_, k) => next.push(k));
    for (const n of next) if (n >= 0 && n < slides.length && !seen.has(n)) { seen.add(n); queue.push(n); }
  }
  return slides.filter((_, i) => !seen.has(i));
}

function suspendEstimate(project: Project): number {
  const graded = gradedBlockIds(project).length;
  const state: CompactResume = {
    v: 2,
    si: project.slides.length - 1,
    n: [project.slides.length, graded],
    vw: '1'.repeat(project.slides.length),
    // Worst case: every question answered and every variable off its default.
    an: '1'.repeat(graded),
    at: '1'.repeat(graded),
    sc: 100,
    vr: Object.fromEntries(project.variables.map((v) => [v.name, v.type === 'string' ? 'xxxxxxxxxx' : v.type === 'number' ? 99999 : !v.defaultValue]))
  };
  return JSON.stringify(state).length;
}

export function runChecks(project: Project, target: string): Check[] {
  const out: Check[] = [];
  const n = (i: number) => i + 1;
  const slideNo = (id: string) => n(project.slides.findIndex((s) => s.id === id));
  const tracked = target === 'scorm12' || target === 'scorm2004' || target === 'xapi';
  const mode = project.completion?.mode ?? 'allSlides';

  // 1. Triggers that point at things that no longer exist.
  const issues: TriggerIssue[] = projectTriggerIssues(project);
  const byTrigger = new Map<string, TriggerIssue[]>();
  for (const is of issues) byTrigger.set(is.triggerId, [...(byTrigger.get(is.triggerId) ?? []), is]);
  const shown = [...byTrigger.entries()].slice(0, 6);
  for (const [tid, list] of shown) {
    const deleted = list.find((x) => x.missing === 'deleted');
    const first = deleted ?? list[0];
    const slide = project.slides.find((s) => s.id === first.slideId)!;
    out.push({
      sev: deleted ? 'error' : 'warn',
      title: deleted ? `Trigger points at a deleted ${first.kind}` : 'Trigger is missing a target',
      detail: `Slide ${slideNo(slide.id)} · ${first.message}`,
      fix: { label: 'Open trigger', slideId: slide.id, triggerId: tid }
    });
  }
  if (byTrigger.size > shown.length) {
    out.push({ sev: 'warn', title: `${byTrigger.size - shown.length} more triggers need attention`, detail: 'Fix the ones above, then check again.' });
  }

  // 2. Images a screen reader can't describe.
  const noAlt: { slide: Slide; block: Block }[] = [];
  for (const s of project.slides) {
    for (const b of slideBlocks(s)) {
      if (b.type !== 'image') continue;
      const alt = String((b.props as { alt?: string }).alt ?? '').trim();
      if (!alt && b.aria !== 'exclude' && !b.accLabel?.trim()) noAlt.push({ slide: s, block: b });
    }
  }
  if (noAlt.length) {
    out.push({
      sev: 'warn',
      title: `${noAlt.length} image${noAlt.length === 1 ? '' : 's'} missing alt text`,
      detail: noAlt.slice(0, 3).map((x) => `Slide ${slideNo(x.slide.id)}`).join(', ') + (noAlt.length > 3 ? ` and ${noAlt.length - 3} more` : '') + '. Mark purely decorative images as excluded from screen readers.',
      fix: { label: 'Add alt text', slideId: noAlt[0].slide.id, blockId: noAlt[0].block.id }
    });
  } else if (project.slides.some((s) => slideBlocks(s).some((b) => b.type === 'image'))) {
    out.push({ sev: 'pass', title: 'All images have alt text' });
  }

  // 2b. Videos with no captions (WCAG 1.2.2).
  const noCaptions: { slide: Slide; block: Block }[] = [];
  for (const s of project.slides) {
    for (const b of slideBlocks(s)) {
      const v = b.props as { src?: string; captionsVtt?: string };
      if (b.type === 'video' && v.src && !v.captionsVtt?.trim()) noCaptions.push({ slide: s, block: b });
    }
  }
  if (noCaptions.length) {
    out.push({
      sev: 'warn',
      title: `${noCaptions.length} video${noCaptions.length === 1 ? '' : 's'} without captions`,
      detail: noCaptions.slice(0, 3).map((x) => `Slide ${slideNo(x.slide.id)}`).join(', ') + '. Captions are needed for learners who are deaf or hard of hearing.',
      fix: { label: 'Add captions', slideId: noCaptions[0].slide.id, blockId: noCaptions[0].block.id }
    });
  }

  // 2c. Clickable objects a screen reader can only call "Hotspot".
  const unnamed: { slide: Slide; block: Block }[] = [];
  for (const s of project.slides) {
    const sources = new Set(s.triggers.filter((t) => t.sourceBlockId && /^on(Click|DoubleClick)$/.test(t.event)).map((t) => t.sourceBlockId!));
    for (const b of slideBlocks(s)) {
      if (!sources.has(b.id) || b.aria === 'exclude') continue;
      const text = b.type === 'button' ? String((b.props as { label?: string }).label ?? '').trim()
        : b.type === 'image' ? String((b.props as { alt?: string }).alt ?? '').trim() : '';
      if (!b.name?.trim() && !b.accLabel?.trim() && !text) unnamed.push({ slide: s, block: b });
    }
  }
  if (unnamed.length) {
    out.push({
      sev: 'warn',
      title: `${unnamed.length} clickable object${unnamed.length === 1 ? ' has' : 's have'} no name`,
      detail: unnamed.slice(0, 3).map((x) => `Slide ${slideNo(x.slide.id)}`).join(', ') + '. A screen reader can only say "' + (unnamed[0].block.type === 'hotspot' ? 'Hotspot' : unnamed[0].block.type) + '". Give each a Name or a screen-reader label.',
      fix: { label: 'Name it', slideId: unnamed[0].slide.id, blockId: unnamed[0].block.id }
    });
  }

  // 3. Big embedded files.
  const { media } = collectMedia(project);
  for (const m of media.filter((x) => x.bytes >= BIG_MEDIA_BYTES).slice(0, 3)) {
    out.push({
      sev: 'warn',
      title: 'Large media file',
      detail: `${m.mime} ${m.slideIndex !== null ? `on slide ${n(m.slideIndex)}` : 'in the course settings'} is ${formatBytes(m.bytes)}. Large files slow the course and can hit LMS upload limits.`,
      compress: isCompressible(m.mime) ? { path: m.path, mime: m.mime } : undefined
    });
  }

  // 4. Completion and scoring.
  const graded = gradedBlockIds(project).length;
  const autoScore = !!project.completion?.autoScore;
  const hasSetScore = project.slides.some((s) => s.triggers.some((t) => t.actions.some((a) => a.type === 'setScore')));
  const needsScore = completionNeedsPass(project) || (tracked && autoScore);
  if (mode === 'explicit') {
    const where = project.slides.findIndex((s) => s.triggers.some((t) => t.actions.some((a) => a.type === 'completeCourse')));
    const viaJs = project.slides.some((s) => s.triggers.some((t) => t.actions.some((a) => a.type === 'executeJs' && /complete\s*\(/.test(a.code))));
    const inCode = project.slides.some((s) => slideBlocks(s).some((b) => b.type === 'code' && /complete\s*\(/.test(String((b.props as { js?: string }).js ?? ''))));
    if (where >= 0) out.push({ sev: 'pass', title: `"Complete course" action found on slide ${n(where)}` });
    else if (viaJs || inCode) out.push({ sev: 'pass', title: 'Completion is called from custom code' });
    else out.push({ sev: 'error', title: 'Nothing ever completes the course', detail: 'Completion is set to an explicit trigger but no "Complete course" action exists. Add one, or pick a different completion rule.' });
  }
  if (completionNeedsPass(project)) {
    if (!autoScore && !hasSetScore) {
      out.push({ sev: 'error', title: 'The score is never set', detail: 'This completion rule needs a score. Turn on Calculate from answers, or add a Set score trigger.' });
    }
    if (autoScore && graded === 0) {
      out.push({ sev: 'error', title: 'No scored questions in the course', detail: 'Calculate from answers needs at least one question block. Add one, or use a Set score trigger.' });
    }
    if (passingScoreOf(project) === 0) out.push({ sev: 'warn', title: 'Pass mark is 0%', detail: 'Every attempt will pass.' });
  }
  if (autoScore && graded > 0 && needsScore) out.push({ sev: 'pass', title: `Score comes from ${graded} scored question${graded === 1 ? '' : 's'}` });

  // 4b. Question banks.
  const seenInBank = new Map<string, string>();
  for (const bank of project.banks ?? []) {
    const live = bank.slideIds.filter((id) => project.slides.some((s) => s.id === id));
    if (live.length === 0) out.push({ sev: 'warn', title: `Question bank "${bank.name}" is empty`, detail: 'Add slides to it or delete it.' });
    else if (bank.draw > live.length) out.push({ sev: 'warn', title: `"${bank.name}" draws ${bank.draw} but has only ${live.length} slides`, detail: 'Learners will get all of them.' });
    for (const id of live) {
      const first = seenInBank.get(id);
      if (first) out.push({ sev: 'warn', title: `A slide is in two banks ("${first}" and "${bank.name}")`, detail: 'It counts for the first bank only.', fix: { label: 'Go to slide', slideId: id } });
      else seenInBank.set(id, bank.name);
    }
  }
  if ((project.banks ?? []).some((b) => b.draw > 0 && b.draw < b.slideIds.length)) {
    out.push({ sev: 'pass', title: 'Question banks draw a random selection per learner', detail: 'The score counts only the questions each learner is given.' });
  }

  // 5. SCORM 1.2 suspend data.
  if (target === 'scorm12') {
    const used = suspendEstimate(project);
    const sev: Severity = used > SCORM12_SUSPEND_CAP ? 'warn' : used > SCORM12_SUSPEND_CAP * 0.75 ? 'warn' : 'pass';
    out.push({
      sev,
      title: sev === 'pass' ? 'Resume data fits SCORM 1.2 limits' : 'SCORM 1.2 caps resume data at 4,096 characters',
      detail: `This course would use about ${used.toLocaleString()} in the worst case.${sev === 'warn' ? ' Beyond the cap, variable values are dropped on resume; position and score are kept.' : ''}`
    });
  }

  // 6. Navigation and fonts.
  const lost = unreachableSlides(project);
  if (lost.length) {
    out.push({
      sev: 'warn',
      title: `${lost.length} slide${lost.length === 1 ? '' : 's'} can't be reached`,
      detail: lost.slice(0, 3).map((s) => `${slideNo(s.id)}. ${s.name}`).join(', ') + '. Next is hidden, there is no menu, and no trigger goes there.',
      fix: { label: 'Go to slide', slideId: lost[0].id }
    });
  } else {
    out.push({ sev: 'pass', title: `All ${project.slides.length} slides reachable from slide 1` });
  }
  const fonts = (project.fonts?.length ?? 0) + new Set((project.embeddedFonts ?? []).map((f) => f.family)).size;
  if (fonts > 0) out.push({ sev: 'pass', title: `${fonts} font ${fonts === 1 ? 'family' : 'families'} included` });

  const order: Record<Severity, number> = { error: 0, warn: 1, pass: 2 };
  return out.map((c, i) => ({ c, i })).sort((a, b) => order[a.c.sev] - order[b.c.sev] || a.i - b.i).map((x) => x.c);
}
