import type { Action, Block, Project, Slide, Trigger } from '../schema/types';
import { SELF_TARGET } from '../schema/types';

// Finds triggers that point at things that no longer exist (a deleted block,
// layer, slide or variable) or that were never given a target. Used by the
// Triggers panel (red badges) and the Publish checks (a blocking error).

export type TargetKind = 'block' | 'layer' | 'slide' | 'variable' | 'cue' | 'key';

export interface TriggerIssue {
  slideId: string;
  triggerId: string;
  // Where in the trigger: its source, a condition, or one of its actions.
  part: 'source' | 'watch' | 'condition' | 'action';
  index?: number;       // condition or action index
  kind: TargetKind;
  missing: 'deleted' | 'unset';
  message: string;
}

const BLOCK_ACTIONS = new Set([
  'showBlock', 'hideBlock', 'toggleBlock', 'setState', 'playAudio', 'pauseAudio',
  'pulseBlock', 'playMotion', 'resetBlock'
]);
const LAYER_ACTIONS = new Set(['showLayer', 'hideLayer']);
const VARIABLE_ACTIONS = new Set(['setVariable', 'adjustVariable', 'resetVariable']);

const SOURCE_EVENTS = new Set([
  'onClick', 'onHover', 'onMouseLeave', 'onDoubleClick', 'onBlockEnters', 'onAnimationComplete'
]);

function walk(blocks: Block[]): Block[] {
  return blocks.flatMap((b) =>
    b.type === 'group' ? [b, ...walk((b.props as { blocks: Block[] }).blocks)] : [b]
  );
}

export function slideBlockIds(slide: Slide): Set<string> {
  return new Set(slide.layers.flatMap((l) => walk(l.blocks)).map((b) => b.id));
}

export function slideTriggerIssues(slide: Slide, project: Project): TriggerIssue[] {
  const blocks = slideBlockIds(slide);
  const layers = new Set(slide.layers.map((l) => l.id));
  const slides = new Set(project.slides.map((s) => s.id));
  const variables = new Set(project.variables.map((v) => v.id));
  const lightboxes = new Set(project.slides.filter((s) => s.lightbox).map((s) => s.id));
  const cues = new Set((slide.timeline?.cues ?? []).map((c) => c.id));
  const issues: TriggerIssue[] = [];

  for (const t of slide.triggers) {
    const add = (
      part: TriggerIssue['part'], kind: TargetKind, missing: 'deleted' | 'unset',
      message: string, index?: number
    ) => issues.push({ slideId: slide.id, triggerId: t.id, part, kind, missing, message, index });

    if (SOURCE_EVENTS.has(t.event)) {
      if (!t.sourceBlockId) add('source', 'block', 'unset', 'No source block chosen.');
      else if (!blocks.has(t.sourceBlockId)) add('source', 'block', 'deleted', 'The source block was deleted.');
    }
    if (t.event === 'onStateAll') {
      const ids = t.watchBlockIds ?? [];
      if (!ids.length) add('watch', 'block', 'unset', 'No blocks chosen to watch.');
      else if (ids.some((id) => !blocks.has(id))) add('watch', 'block', 'deleted', 'A watched block was deleted.');
    }
    if (t.event === 'onCuePoint') {
      if (!t.cueId) add('watch', 'cue', 'unset', 'No cue chosen.');
      else if (!cues.has(t.cueId)) add('watch', 'cue', 'deleted', 'The cue was deleted.');
    }
    if (t.event === 'onVariableChange' && t.watchVariableId && !variables.has(t.watchVariableId)) {
      add('watch', 'variable', 'deleted', 'The watched variable was deleted.');
    }
    if (t.event === 'onKeyPress' && !t.key) add('watch', 'key', 'unset', 'No key chosen.');

    t.conditions.forEach((c, i) => {
      if (c.blockId) {
        if (!blocks.has(c.blockId)) add('condition', 'block', 'deleted', 'A condition block was deleted.', i);
      } else if (!c.variableId) {
        add('condition', 'variable', 'unset', 'A condition has no variable.', i);
      } else if (!variables.has(c.variableId)) {
        add('condition', 'variable', 'deleted', 'A condition variable was deleted.', i);
      }
    });

    t.actions.forEach((a, i) => actionIssue(a, t, i, { blocks, layers, slides, lightboxes, variables }, add));
  }
  return issues;
}

function actionIssue(
  a: Action,
  t: Trigger,
  i: number,
  have: { blocks: Set<string>; layers: Set<string>; slides: Set<string>; lightboxes: Set<string>; variables: Set<string> },
  add: (part: TriggerIssue['part'], kind: TargetKind, missing: 'deleted' | 'unset', message: string, index?: number) => void
): void {
  const check = (kind: TargetKind, id: string | undefined, set: Set<string>, noun: string) => {
    if (!id) add('action', kind, 'unset', `Choose a ${noun}.`, i);
    else if (!set.has(id)) add('action', kind, 'deleted', `The ${noun} was deleted. Choose a new one.`, i);
  };
  if (BLOCK_ACTIONS.has(a.type)) {
    const id = (a as { blockId?: string }).blockId;
    // "This object" resolves to the trigger's source, which only exists for
    // block events; elsewhere it is a harmless no-op, not an error.
    if (id === SELF_TARGET && t.sourceBlockId) return;
    check('block', id, have.blocks, 'block');
  } else if (LAYER_ACTIONS.has(a.type)) {
    check('layer', (a as { layerId?: string }).layerId, have.layers, 'layer');
  } else if (a.type === 'goToSlide') {
    check('slide', a.slideId, have.slides, 'slide');
  } else if (a.type === 'openLightbox') {
    check('slide', a.slideId, have.lightboxes, 'lightbox slide');
  } else if (VARIABLE_ACTIONS.has(a.type)) {
    check('variable', (a as { variableId?: string }).variableId, have.variables, 'variable');
  }
}

export function projectTriggerIssues(project: Project): TriggerIssue[] {
  return project.slides.flatMap((s) => slideTriggerIssues(s, project));
}
