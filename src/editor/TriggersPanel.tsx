import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { BlockState, ConditionOperator } from '../schema/types';
import type {
  Action, ActionType, Block, Slide, Trigger, TriggerEvent, Variable, VariableValue
} from '../schema/types';
import { useCurrentSlide, useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { uid } from '../schema/factory';
import { SELF_TARGET } from '../schema/types';
import { slideTriggerIssues } from '../engine/validate';
import { SelectInput } from './fields';
import { variableLabel } from '../shared/variableLabel';
import { Lucide } from './lucide';

// Triggers panel. Each trigger reads as a sentence: WHEN <source> <event>,
// IF <conditions>, THEN <actions>. Every part is a chip; clicking a chip opens
// a picker tray under the trigger, so nothing is squeezed into a narrow
// dropdown. Collapsed, a trigger is one line.

// Operators offered per variable type. String variables get contains;
// number variables get the comparison set; booleans stay with =/not =.
const OPERATORS: { value: ConditionOperator; label: string; types: string[] }[] = [
  { value: 'eq', label: '=', types: ['boolean', 'number', 'string'] },
  { value: 'ne', label: 'not =', types: ['boolean', 'number', 'string'] },
  { value: 'gt', label: '>', types: ['number'] },
  { value: 'lt', label: '<', types: ['number'] },
  { value: 'gte', label: '>=', types: ['number'] },
  { value: 'lte', label: '<=', types: ['number'] },
  { value: 'between', label: 'between', types: ['number'] },
  { value: 'contains', label: 'contains', types: ['string'] },
  { value: 'notContains', label: "doesn't contain", types: ['string'] },
  { value: 'startsWith', label: 'starts with', types: ['string'] },
  { value: 'endsWith', label: 'ends with', types: ['string'] },
  { value: 'isEmpty', label: 'is empty', types: ['boolean', 'number', 'string'] },
  { value: 'notEmpty', label: 'is not empty', types: ['boolean', 'number', 'string'] }
];

function blockLabel(b: Block, max = 60): string {
  const short = (s: string) => (s.length > max ? `${s.slice(0, max)}...` : s);
  if (b.name && b.name.trim()) return short(b.name.trim());
  switch (b.type) {
    case 'text': {
      const div = document.createElement('div');
      div.innerHTML = (b.props as { html: string }).html;
      return `Text: ${short(div.textContent || 'empty')}`;
    }
    case 'image':
      return `Image: ${short((b.props as { alt: string }).alt || 'untitled')}`;
    case 'statement':
      return `Statement: ${short((b.props as { heading: string }).heading)}`;
    case 'multipleChoice':
      return `Question: ${short((b.props as { question: string }).question)}`;
    default:
      return `${b.type.charAt(0).toUpperCase()}${b.type.slice(1)} block`;
  }
}

function blockIcon(type: string): string {
  switch (type) {
    case 'text': case 'statement': return 'type';
    case 'image': return 'image';
    case 'button': return 'rectangle-horizontal';
    case 'multipleChoice': case 'matching': case 'fillBlank': case 'dragDrop': case 'sequence': return 'circle-help';
    case 'audio': return 'audio-lines';
    case 'video': return 'play';
    case 'textEntry': return 'text-cursor-input';
    case 'hotspot': return 'mouse-pointer-click';
    case 'code': return 'code';
    case 'slider': return 'sliders-horizontal';
    case 'checklist': return 'list-checks';
    default: return 'box';
  }
}

function slideBlocks(slide: Slide): { block: Block; layerName: string }[] {
  return slide.layers.flatMap((l) => l.blocks.map((block) => ({ block, layerName: l.name })));
}

function defaultValueFor(v: Variable | undefined): VariableValue {
  if (!v) return '';
  return v.type === 'boolean' ? true : v.type === 'number' ? 0 : '';
}

function coerce(v: Variable | undefined, raw: string): VariableValue {
  if (!v) return raw;
  if (v.type === 'boolean') return raw === 'true';
  if (v.type === 'number') return Number(raw);
  return raw;
}

function ValueInput({ variable, value, onChange }: {
  variable: Variable | undefined;
  value: VariableValue;
  onChange: (v: VariableValue) => void;
}) {
  if (variable?.type === 'boolean') {
    return (
      <SelectInput
        value={String(value)}
        options={[{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }]}
        onChange={(raw) => onChange(raw === 'true')}
      />
    );
  }
  if (variable?.type === 'number') {
    return (
      <input
        className="input"
        type="number"
        value={Number(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }
  return (
    <input
      className="input"
      type="text"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Keys a trigger can listen for: values are KeyboardEvent.key.
const KEY_OPTIONS = [
  { value: 'Enter', label: 'Enter' },
  { value: ' ', label: 'Space' },
  { value: 'ArrowLeft', label: 'Left arrow' },
  { value: 'ArrowRight', label: 'Right arrow' },
  { value: 'ArrowUp', label: 'Up arrow' },
  { value: 'ArrowDown', label: 'Down arrow' },
  { value: 'Escape', label: 'Escape' },
  ...'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => ({ value: c, label: c.toUpperCase() })),
  ...'0123456789'.split('').map((c) => ({ value: c, label: c }))
];

// ---- events -----------------------------------------------------------------

interface EventDef { label: string; short: string; icon: string; scope: 'block' | 'slide' }

const EVENTS: Record<TriggerEvent, EventDef> = {
  onClick: { label: 'is clicked', short: 'clicked', icon: 'mouse-pointer-click', scope: 'block' },
  onHover: { label: 'is hovered', short: 'hovered', icon: 'pointer', scope: 'block' },
  onMouseLeave: { label: 'is un-hovered', short: 'un-hovered', icon: 'pointer', scope: 'block' },
  onDoubleClick: { label: 'is double-clicked', short: 'double-clicked', icon: 'mouse-pointer-2', scope: 'block' },
  onBlockEnters: { label: 'enters the frame', short: 'enters the frame', icon: 'play', scope: 'block' },
  onAnimationComplete: { label: 'finishes animating in', short: 'finishes animating', icon: 'activity', scope: 'block' },
  onSlideLoad: { label: 'loads', short: 'loads', icon: 'presentation', scope: 'slide' },
  onTimelineStart: { label: 'timeline starts', short: 'timeline starts', icon: 'play', scope: 'slide' },
  onTimelineEnd: { label: 'timeline ends', short: 'timeline ends', icon: 'timer', scope: 'slide' },
  onSubmit: { label: 'Submit is pressed', short: 'Submit pressed', icon: 'check', scope: 'slide' },
  onKeyPress: { label: 'a key is pressed', short: 'key pressed', icon: 'keyboard', scope: 'slide' },
  onCuePoint: { label: 'timeline reaches a cue', short: 'reaches a cue', icon: 'flag', scope: 'slide' },
  onVariableChange: { label: 'a variable changes', short: 'variable changes', icon: 'variable', scope: 'slide' },
  onStateAll: { label: 'blocks all reach a state', short: 'blocks reach a state', icon: 'list-checks', scope: 'slide' }
};
const BLOCK_EVENTS = (Object.keys(EVENTS) as TriggerEvent[]).filter((e) => EVENTS[e].scope === 'block');
const SLIDE_EVENTS = (Object.keys(EVENTS) as TriggerEvent[]).filter((e) => EVENTS[e].scope === 'slide');

// ---- actions ----------------------------------------------------------------

type Param =
  | 'block' | 'audio' | 'layer' | 'slide' | 'variable' | 'value' | 'delta' | 'score'
  | 'state' | 'button' | 'enabled' | 'emphasis' | 'seconds' | 'url' | 'code';

interface ActionDef { verb: string; icon: string; group: string; params: Param[] }

const G_BLOCKS = 'Layers and blocks';
const G_NAV = 'Navigation';
const G_VARS = 'Variables and score';
const G_MEDIA = 'Timeline and media';
const G_PLAYER = 'Player and code';

const ACTIONS: Record<ActionType, ActionDef> = {
  showLayer: { verb: 'show layer', icon: 'layers', group: G_BLOCKS, params: ['layer'] },
  hideLayer: { verb: 'hide layer', icon: 'layers', group: G_BLOCKS, params: ['layer'] },
  showBlock: { verb: 'show block', icon: 'eye', group: G_BLOCKS, params: ['block'] },
  hideBlock: { verb: 'hide block', icon: 'eye-off', group: G_BLOCKS, params: ['block'] },
  toggleBlock: { verb: 'toggle block', icon: 'eye', group: G_BLOCKS, params: ['block'] },
  setState: { verb: 'set state of', icon: 'box', group: G_BLOCKS, params: ['block', 'state'] },
  resetBlock: { verb: 'reset block', icon: 'rotate-ccw', group: G_BLOCKS, params: ['block'] },
  pulseBlock: { verb: 'emphasize', icon: 'activity', group: G_BLOCKS, params: ['block', 'emphasis'] },
  playMotion: { verb: 'play motion path of', icon: 'activity', group: G_BLOCKS, params: ['block'] },
  goToSlide: { verb: 'go to slide', icon: 'arrow-right', group: G_NAV, params: ['slide'] },
  nextSlide: { verb: 'go to next slide', icon: 'skip-forward', group: G_NAV, params: [] },
  prevSlide: { verb: 'go to previous slide', icon: 'skip-back', group: G_NAV, params: [] },
  restartSlide: { verb: 'restart this slide', icon: 'rotate-ccw', group: G_NAV, params: [] },
  openUrl: { verb: 'open URL', icon: 'link', group: G_NAV, params: ['url'] },
  completeCourse: { verb: 'complete course', icon: 'circle-check', group: G_NAV, params: [] },
  exitCourse: { verb: 'exit course', icon: 'log-out', group: G_NAV, params: [] },
  setVariable: { verb: 'set variable', icon: 'variable', group: G_VARS, params: ['variable', 'value'] },
  adjustVariable: { verb: 'adjust variable', icon: 'variable', group: G_VARS, params: ['variable', 'delta'] },
  resetVariable: { verb: 'reset variable', icon: 'rotate-ccw', group: G_VARS, params: ['variable'] },
  setScore: { verb: 'set score', icon: 'hash', group: G_VARS, params: ['score'] },
  playAudio: { verb: 'play audio', icon: 'volume-2', group: G_MEDIA, params: ['audio'] },
  pauseAudio: { verb: 'pause audio', icon: 'volume-x', group: G_MEDIA, params: ['audio'] },
  pauseTimeline: { verb: 'pause timeline', icon: 'pause', group: G_MEDIA, params: [] },
  resumeTimeline: { verb: 'resume timeline', icon: 'play', group: G_MEDIA, params: [] },
  seekTimeline: { verb: 'seek timeline to', icon: 'timer', group: G_MEDIA, params: ['seconds'] },
  restartTimeline: { verb: 'restart timeline', icon: 'rotate-ccw', group: G_MEDIA, params: [] },
  setPlayerButton: { verb: 'player button', icon: 'sliders-horizontal', group: G_PLAYER, params: ['button', 'enabled'] },
  executeJs: { verb: 'run JavaScript', icon: 'code', group: G_PLAYER, params: ['code'] }
};
const ACTION_ORDER = Object.keys(ACTIONS) as ActionType[];

const STATES: BlockState[] = ['normal', 'selected', 'visited', 'disabled', 'hidden'];
const EMPHASES = ['pulse', 'bounce', 'shake', 'float'] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- small pieces ----------------------------------------------------------

function Chip(props: {
  icon?: string; children: ReactNode; active?: boolean; error?: boolean; dashed?: boolean;
  chevron?: boolean; onClick: () => void; title?: string; strong?: boolean; expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tp-chip${props.active ? ' active' : ''}${props.error ? ' err' : ''}${props.dashed ? ' dashed' : ''}${props.strong ? ' strong' : ''}`}
      onClick={props.onClick}
      title={props.title}
      aria-expanded={props.expanded}
    >
      {props.icon && <Lucide name={props.icon} size={14} className="tp-chip-icon" />}
      <span className="tp-chip-text">{props.children}</span>
      {props.chevron && <Lucide name="chevron-down" size={12} className="tp-chip-chev" />}
    </button>
  );
}

interface TrayOption { label: string; icon?: string; selected?: boolean; danger?: boolean; group?: string; pick: () => void }

type Open = { tid: string; field: string; i?: number };

export function TriggersPanel() {
  const slide = useCurrentSlide();
  const project = useProjectStore((s) => s.project);
  const mutate = useProjectStore((s) => s.mutate);
  const focusTriggerId = useUiStore((s) => s.focusTriggerId);
  const setFocusTriggerId = useUiStore((s) => s.setFocusTriggerId);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState<Open | null>(null);

  const blocks = slideBlocks(slide);
  const audioBlocks = blocks.filter(({ block }) => block.type === 'audio');
  const variables = project.variables;
  const slideIndex = project.slides.findIndex((s) => s.id === slide.id);

  // Leaving the slide closes any open picker; a link from the Publish checks
  // opens the trigger it points at.
  useEffect(() => { setOpen(null); }, [slide.id]);
  useEffect(() => {
    if (focusTriggerId && slide.triggers.some((t) => t.id === focusTriggerId)) {
      setExpanded(focusTriggerId);
      setFocusTriggerId(null);
    }
  }, [focusTriggerId, slide, setFocusTriggerId]);

  const issues = slideTriggerIssues(slide, project);
  const issuesByTrigger = new Map<string, typeof issues>();
  for (const is of issues) issuesByTrigger.set(is.triggerId, [...(issuesByTrigger.get(is.triggerId) ?? []), is]);

  const edit = (triggerId: string, fn: (t: Trigger) => void, history = true) =>
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      const t = s?.triggers.find((tr) => tr.id === triggerId);
      if (t) fn(t);
    }, history);

  const blockById = (id: string) => blocks.find(({ block }) => block.id === id)?.block;

  // "This object" resolves to the trigger's own source block at run time.
  const blockOptions = (t: Trigger, from = blocks): { value: string; label: string; icon: string }[] => {
    const opts = from.map(({ block, layerName }) => ({
      value: block.id, label: `${blockLabel(block)} (${layerName})`, icon: blockIcon(block.type)
    }));
    return t.sourceBlockId ? [{ value: SELF_TARGET, label: 'This object (the source)', icon: 'rotate-cw' }, ...opts] : opts;
  };

  // ---- creating ---------------------------------------------------------------

  const newAction = (type: ActionType): Action => {
    switch (type) {
      case 'showLayer': case 'hideLayer': return { type, layerId: '' };
      case 'showBlock': case 'hideBlock': case 'toggleBlock': case 'resetBlock': case 'playMotion':
        return { type, blockId: '' };
      case 'goToSlide': return { type, slideId: '' };
      case 'setVariable': return { type, variableId: '', value: '' };
      case 'adjustVariable': return { type, variableId: '', delta: 1 };
      case 'resetVariable': return { type, variableId: '' };
      case 'setScore': return { type, score: 100 };
      case 'setState': return { type, blockId: '', state: 'selected' };
      case 'setPlayerButton': return { type, button: 'next', enabled: false };
      case 'playAudio': case 'pauseAudio':
        return { type, blockId: audioBlocks.length === 1 ? audioBlocks[0].block.id : '' };
      case 'pulseBlock': return { type, blockId: '', emphasis: 'pulse' };
      case 'seekTimeline': return { type, seconds: 0 };
      case 'openUrl': return { type, url: 'https://' };
      case 'executeJs': return { type, code: '// forge.setVariable("name", value); forge.nextSlide();\n' };
      case 'completeCourse': case 'exitCourse': case 'pauseTimeline': case 'resumeTimeline':
      case 'restartTimeline': case 'nextSlide': case 'prevSlide': case 'restartSlide':
        return { type };
    }
  };

  const addTrigger = (preset?: 'slide' | 'layer' | 'audio') => {
    const id = uid('trg');
    const firstBlock = blocks[0]?.block.id;
    const t: Trigger = {
      id,
      event: preset === 'audio' || !firstBlock ? 'onSlideLoad' : 'onClick',
      sourceBlockId: preset === 'audio' || !firstBlock ? undefined : firstBlock,
      conditions: [],
      actions: []
    };
    let next: Open = { tid: id, field: 'addAct' };
    if (preset === 'slide') { t.actions = [newAction('goToSlide')]; next = { tid: id, field: 'ap:slide', i: 0 }; }
    if (preset === 'layer') { t.actions = [newAction('showLayer')]; next = { tid: id, field: 'ap:layer', i: 0 }; }
    if (preset === 'audio') {
      t.actions = [newAction('playAudio')];
      if (audioBlocks.length !== 1) next = { tid: id, field: 'ap:audio', i: 0 };
      else next = { tid: id, field: 'addAct' };
    }
    mutate((p) => { p.slides.find((sl) => sl.id === slide.id)?.triggers.push(t); });
    setExpanded(id);
    setOpen(next);
  };

  const move = (tid: string, dir: -1 | 1) =>
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      const i = s?.triggers.findIndex((t) => t.id === tid) ?? -1;
      if (!s || i < 0 || i + dir < 0 || i + dir >= s.triggers.length) return;
      const [t] = s.triggers.splice(i, 1);
      s.triggers.splice(i + dir, 0, t);
    });

  const duplicate = (tid: string) => {
    const copyId = uid('trg');
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      const i = s?.triggers.findIndex((t) => t.id === tid) ?? -1;
      if (!s || i < 0) return;
      const copy = structuredClone(s.triggers[i]);
      copy.id = copyId;
      s.triggers.splice(i + 1, 0, copy);
    });
    setExpanded(copyId);
    setOpen(null);
  };

  const remove = (tid: string) => {
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      if (s) s.triggers = s.triggers.filter((t) => t.id !== tid);
    });
    setOpen(null);
  };

  const toggleOpen = (tid: string, field: string, i?: number) =>
    setOpen((o) => (o && o.tid === tid && o.field === field && o.i === i ? null : { tid, field, i }));

  // ---- labels -------------------------------------------------------------------

  const subjectName = (t: Trigger): { name: string; icon: string; bad: boolean } => {
    if (EVENTS[t.event].scope === 'slide') return { name: 'This slide', icon: 'presentation', bad: false };
    if (!t.sourceBlockId) return { name: 'choose block…', icon: 'box', bad: true };
    const b = blockById(t.sourceBlockId);
    return b ? { name: blockLabel(b), icon: blockIcon(b.type), bad: false } : { name: 'deleted block', icon: 'triangle-alert', bad: true };
  };

  // What a parameter chip shows, and whether it is empty or points at
  // something that no longer exists.
  const paramText = (t: Trigger, a: Action, p: Param): { text: string; empty?: boolean; deleted?: boolean } => {
    const anyA = a as unknown as Record<string, unknown>;
    switch (p) {
      case 'block': case 'audio': {
        const id = anyA.blockId as string;
        if (!id) return { text: 'choose…', empty: true };
        if (id === SELF_TARGET) return { text: 'this object' };
        const b = blockById(id);
        return b ? { text: blockLabel(b) } : { text: 'deleted block', deleted: true };
      }
      case 'layer': {
        const id = anyA.layerId as string;
        if (!id) return { text: 'choose…', empty: true };
        const l = slide.layers.find((x) => x.id === id);
        return l ? { text: l.name } : { text: 'deleted layer', deleted: true };
      }
      case 'slide': {
        const id = anyA.slideId as string;
        if (!id) return { text: 'choose…', empty: true };
        const i = project.slides.findIndex((x) => x.id === id);
        return i >= 0 ? { text: `${i + 1}. ${project.slides[i].name}` } : { text: 'deleted slide', deleted: true };
      }
      case 'variable': {
        const id = anyA.variableId as string;
        if (!id) return { text: 'choose…', empty: true };
        const v = variables.find((x) => x.id === id);
        return v ? { text: variableLabel(project, v) } : { text: 'deleted variable', deleted: true };
      }
      case 'value': {
        const v = anyA.value as VariableValue;
        const vr = variables.find((x) => x.id === (anyA.variableId as string));
        if (!vr) return { text: 'value', empty: true };
        return { text: `= ${typeof v === 'string' ? `"${v}"` : String(v)}` };
      }
      case 'delta': { const d = Number(anyA.delta); return { text: `by ${d >= 0 ? '+' : ''}${d}` }; }
      case 'score': return { text: `${Number(anyA.score)}%` };
      case 'state': return { text: `to ${String(anyA.state)}` };
      case 'button': return { text: `${String(anyA.button)} button` };
      case 'enabled': return { text: anyA.enabled ? 'enabled' : 'disabled' };
      case 'emphasis': return { text: String(anyA.emphasis) };
      case 'seconds': return { text: `${Number(anyA.seconds)}s` };
      case 'url': { const u = String(anyA.url ?? ''); return u.length > 2 && u !== 'https://' ? { text: u } : { text: 'enter URL…', empty: true }; }
      case 'code': return { text: 'edit code' };
    }
  };

  const actionSummary = (t: Trigger, a: Action | undefined): string => {
    if (!a) return 'no actions yet';
    const def = ACTIONS[a.type];
    const first = def.params[0] ? paramText(t, a, def.params[0]) : null;
    const rest = def.params[1] ? paramText(t, a, def.params[1]) : null;
    return [def.verb, first && !first.empty ? first.text : '', rest && !rest.empty ? rest.text : ''].filter(Boolean).join(' ');
  };

  const condLabel = (c: Trigger['conditions'][number]): { text: string; bad: boolean } => {
    if (c.blockId) {
      const b = blockById(c.blockId);
      if (!b) return { text: 'deleted block', bad: true };
      return { text: `${blockLabel(b)} ${c.operator === 'ne' ? 'is not' : 'is'} ${c.blockState ?? 'visited'}`, bad: false };
    }
    const v = variables.find((x) => x.id === c.variableId);
    if (!v) return { text: c.variableId ? 'deleted variable' : 'choose variable…', bad: true };
    const vname = variableLabel(project, v);
    const op = c.operator ?? 'eq';
    const opLabel = OPERATORS.find((o) => o.value === op)?.label ?? op;
    const val = (x: VariableValue | undefined) => (typeof x === 'string' ? `"${x}"` : String(x ?? ''));
    const value = c.value !== undefined ? c.value : c.equals;
    if (op === 'isEmpty' || op === 'notEmpty') return { text: `${vname} ${opLabel}`, bad: false };
    if (op === 'between') return { text: `${vname} between ${val(c.value)} and ${val(c.value2)}`, bad: false };
    return { text: `${vname} ${opLabel} ${val(value)}`, bad: false };
  };

  // ---- trays --------------------------------------------------------------------

  const setAction = (tid: string, i: number, patch: Record<string, unknown>, history = true) =>
    edit(tid, (t) => { Object.assign(t.actions[i], patch); }, history);

  // A picker is either a list of options (single or multi) or a small form.
  const renderTray = (t: Trigger, o: Open): ReactNode => {
    const close = () => setOpen(null);
    const list = (title: string, options: TrayOption[], opts?: { keepOpen?: boolean; note?: string }) => (
      <Tray title={title} onClose={close}>
        {options.length === 0 && <p className="tp-tray-note">{opts?.note ?? 'Nothing to choose from yet.'}</p>}
        {options.map((op, idx) => (
          <div key={idx}>
            {op.group && (idx === 0 || options[idx - 1].group !== op.group) && <div className="tp-tray-group">{op.group}</div>}
            <button
              type="button"
              className={`tp-opt${op.selected ? ' sel' : ''}${op.danger ? ' danger' : ''}`}
              onClick={() => { if (!opts?.keepOpen) close(); op.pick(); }}
            >
              {op.icon && <Lucide name={op.icon} size={14} className="tp-opt-icon" />}
              <span className="tp-opt-label">{op.label}</span>
              {op.selected && <Lucide name="check" size={14} className="tp-opt-check" />}
            </button>
          </div>
        ))}
      </Tray>
    );

    switch (o.field) {
      case 'subject': {
        const opts: TrayOption[] = [
          {
            label: 'This slide', icon: 'presentation', selected: EVENTS[t.event].scope === 'slide',
            pick: () => edit(t.id, (x) => {
              if (EVENTS[x.event].scope !== 'slide') { x.event = 'onSlideLoad'; x.sourceBlockId = undefined; }
            })
          },
          ...blocks.map(({ block, layerName }) => ({
            label: `${blockLabel(block)} (${layerName})`, icon: blockIcon(block.type),
            selected: EVENTS[t.event].scope === 'block' && t.sourceBlockId === block.id,
            pick: () => edit(t.id, (x) => {
              if (EVENTS[x.event].scope !== 'block') { x.event = 'onClick'; x.key = undefined; x.cueId = undefined; x.watchVariableId = undefined; }
              x.sourceBlockId = block.id;
            })
          }))
        ];
        return list('Choose source', opts);
      }
      case 'event': {
        const keys = EVENTS[t.event].scope === 'block' ? BLOCK_EVENTS : SLIDE_EVENTS;
        return list('Choose event', keys.map((k) => ({
          label: EVENTS[k].label, icon: EVENTS[k].icon, selected: t.event === k,
          pick: () => edit(t.id, (x) => {
            x.event = k;
            if (k === 'onKeyPress') x.key = x.key ?? 'Enter'; else x.key = undefined;
            if (k !== 'onCuePoint') x.cueId = undefined;
            if (k === 'onCuePoint') x.cueId = x.cueId ?? slide.timeline?.cues?.[0]?.id;
            if (k !== 'onVariableChange') x.watchVariableId = undefined;
            if (k === 'onStateAll') { x.watchState = x.watchState ?? 'selected'; x.watchBlockIds = x.watchBlockIds ?? []; }
          })
        })));
      }
      case 'key':
        return list('Choose key', KEY_OPTIONS.map((k) => ({
          label: k.label, icon: 'keyboard', selected: (t.key ?? 'Enter') === k.value,
          pick: () => edit(t.id, (x) => { x.key = k.value; })
        })));
      case 'cue': {
        const cues = slide.timeline?.cues ?? [];
        return list('Choose cue', cues.map((c) => ({
          label: `${c.name} (${c.time.toFixed(1)}s)`, icon: 'flag', selected: t.cueId === c.id,
          pick: () => edit(t.id, (x) => { x.cueId = c.id; })
        })), { note: 'Add a cue on the timeline ruler first (right-click the ruler).' });
      }
      case 'watchVar':
        return list('Watch variable', [
          { label: 'Any variable', icon: 'variable', selected: !t.watchVariableId, pick: () => edit(t.id, (x) => { x.watchVariableId = undefined; }) },
          ...variables.map((v) => ({
            label: variableLabel(project, v), icon: 'variable', selected: t.watchVariableId === v.id,
            pick: () => edit(t.id, (x) => { x.watchVariableId = v.id; })
          }))
        ]);
      case 'watchBlocks':
        return list('Blocks to watch', blocks.map(({ block, layerName }) => ({
          label: `${blockLabel(block)} (${layerName})`, icon: blockIcon(block.type),
          selected: t.watchBlockIds?.includes(block.id),
          pick: () => edit(t.id, (x) => {
            const set = new Set(x.watchBlockIds ?? []);
            if (set.has(block.id)) set.delete(block.id); else set.add(block.id);
            x.watchBlockIds = [...set];
          })
        })), { keepOpen: true });
      case 'watchState':
        return list('When all reach state', (['selected', 'visited', 'disabled', 'hidden', 'normal'] as BlockState[]).map((s) => ({
          label: s, selected: (t.watchState ?? 'selected') === s, pick: () => edit(t.id, (x) => { x.watchState = s; })
        })));
      case 'cond': {
        const ci = o.i ?? 0;
        const c = t.conditions[ci];
        if (!c) return null;
        const variable = variables.find((v) => v.id === c.variableId);
        const subject = c.blockId ? `blk:${c.blockId}` : `var:${c.variableId}`;
        return (
          <Tray title="Edit condition" onClose={close}>
            <div className="tp-form">
              <SelectInput
                value={subject}
                options={[
                  ...(c.variableId || c.blockId ? [] : [{ value: 'var:', label: 'Choose…' }]),
                  ...variables.map((v) => ({ value: `var:${v.id}`, label: variableLabel(project, v) })),
                  ...blocks.map(({ block, layerName }) => ({ value: `blk:${block.id}`, label: `state of ${blockLabel(block)} (${layerName})` }))
                ]}
                onChange={(raw) => edit(t.id, (x) => {
                  const cc = x.conditions[ci];
                  if (raw.startsWith('blk:')) {
                    cc.blockId = raw.slice(4); cc.blockState = cc.blockState ?? 'visited'; cc.variableId = '';
                    cc.operator = cc.operator === 'ne' ? 'ne' : 'eq'; cc.value = undefined; cc.value2 = undefined; delete cc.equals;
                  } else {
                    const nv = variables.find((v) => v.id === raw.slice(4));
                    cc.variableId = raw.slice(4); cc.blockId = undefined; cc.blockState = undefined;
                    cc.value = defaultValueFor(nv); delete cc.equals;
                  }
                })}
              />
              {c.blockId ? (
                <div className="tp-form-row">
                  <SelectInput
                    value={c.operator === 'ne' ? 'ne' : 'eq'}
                    options={[{ value: 'eq', label: 'is' }, { value: 'ne', label: 'is not' }]}
                    onChange={(v) => edit(t.id, (x) => { x.conditions[ci].operator = v as ConditionOperator; })}
                  />
                  <SelectInput
                    value={c.blockState ?? 'visited'}
                    options={(['visited', 'selected', 'normal', 'disabled', 'hidden'] as const).map((s) => ({ value: s, label: s }))}
                    onChange={(v) => edit(t.id, (x) => { x.conditions[ci].blockState = v as BlockState; })}
                  />
                </div>
              ) : (
                <>
                  <SelectInput
                    value={c.operator ?? 'eq'}
                    options={OPERATORS.filter((op) => op.types.includes(variable?.type ?? 'string')).map((op) => ({ value: op.value, label: op.label }))}
                    onChange={(v) => edit(t.id, (x) => { x.conditions[ci].operator = v as ConditionOperator; })}
                  />
                  {c.operator !== 'isEmpty' && c.operator !== 'notEmpty' && (
                    <div className="tp-form-row">
                      <ValueInput
                        variable={variable}
                        value={(c.value !== undefined ? c.value : c.equals) ?? ''}
                        onChange={(v) => edit(t.id, (x) => { x.conditions[ci].value = v; delete x.conditions[ci].equals; }, false)}
                      />
                      {c.operator === 'between' && (
                        <>
                          <span className="tp-form-and">and</span>
                          <ValueInput
                            variable={variable}
                            value={c.value2 ?? ''}
                            onChange={(v) => edit(t.id, (x) => { x.conditions[ci].value2 = v; }, false)}
                          />
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
              <button type="button" className="tp-opt danger" onClick={() => { edit(t.id, (x) => { x.conditions.splice(ci, 1); }); close(); }}>
                <Lucide name="x" size={14} className="tp-opt-icon" /><span className="tp-opt-label">Remove condition</span>
              </button>
            </div>
          </Tray>
        );
      }
      case 'actType':
      case 'addAct': {
        const idx = o.field === 'addAct' ? t.actions.length : (o.i ?? 0);
        const current = o.field === 'actType' ? t.actions[idx]?.type : undefined;
        return list(o.field === 'addAct' ? 'Add action' : 'Choose action', ACTION_ORDER.map((k) => ({
          label: cap(ACTIONS[k].verb), icon: ACTIONS[k].icon, group: ACTIONS[k].group, selected: current === k,
          pick: () => {
            edit(t.id, (x) => { x.actions[idx] = newAction(k); });
            const first = ACTIONS[k].params[0];
            setOpen(first ? { tid: t.id, field: `ap:${first}`, i: idx } : null);
          }
        })));
      }
      default:
        break;
    }

    if (o.field.startsWith('ap:')) {
      const p = o.field.slice(3) as Param;
      const ai = o.i ?? 0;
      const a = t.actions[ai];
      if (!a) return null;
      const anyA = a as unknown as Record<string, unknown>;
      switch (p) {
        case 'block': case 'audio': {
          const from = p === 'audio' && audioBlocks.length ? audioBlocks : blocks;
          return list(p === 'audio' ? 'Choose audio' : 'Choose block', blockOptions(t, from).map((b) => ({
            label: b.label, icon: b.icon, selected: anyA.blockId === b.value, pick: () => setAction(t.id, ai, { blockId: b.value })
          })));
        }
        case 'layer':
          return list('Choose layer', slide.layers.map((l) => ({
            label: l.name, icon: 'layers', selected: anyA.layerId === l.id, pick: () => setAction(t.id, ai, { layerId: l.id })
          })));
        case 'slide':
          return list('Choose slide', project.slides.map((s, i) => ({
            label: `${i + 1}. ${s.name}`, icon: 'presentation', selected: anyA.slideId === s.id, pick: () => setAction(t.id, ai, { slideId: s.id })
          })));
        case 'variable':
          return list('Choose variable', variables.map((v) => ({
            label: variableLabel(project, v), icon: 'variable', selected: anyA.variableId === v.id,
            pick: () => edit(t.id, (x) => {
              const act = x.actions[ai] as unknown as Record<string, unknown>;
              act.variableId = v.id;
              if (act.type === 'setVariable') act.value = defaultValueFor(v);
            })
          })), { note: 'No variables yet. Create one in the Variables tab.' });
        case 'state':
          return list('Set state to', STATES.map((s) => ({ label: s, selected: anyA.state === s, pick: () => setAction(t.id, ai, { state: s }) })));
        case 'button':
          return list('Player button', (['next', 'back', 'submit'] as const).map((b) => ({ label: b, selected: anyA.button === b, pick: () => setAction(t.id, ai, { button: b }) })));
        case 'enabled':
          return list('Set to', [
            { label: 'enabled', selected: anyA.enabled === true, pick: () => setAction(t.id, ai, { enabled: true }) },
            { label: 'disabled', selected: anyA.enabled === false, pick: () => setAction(t.id, ai, { enabled: false }) }
          ]);
        case 'emphasis':
          return list('Emphasis', EMPHASES.map((e) => ({ label: e, selected: anyA.emphasis === e, pick: () => setAction(t.id, ai, { emphasis: e }) })));
        case 'value': {
          const v = variables.find((x) => x.id === anyA.variableId);
          return (
            <Tray title="New value" onClose={close}>
              <div className="tp-form">
                <ValueInput variable={v} value={anyA.value as VariableValue} onChange={(val) => setAction(t.id, ai, { value: val }, v?.type === 'boolean')} />
              </div>
            </Tray>
          );
        }
        case 'delta':
          return (
            <Tray title="Adjust by" onClose={close}>
              <div className="tp-form">
                <input className="input" type="number" value={Number(anyA.delta)} onChange={(e) => setAction(t.id, ai, { delta: Number(e.target.value) || 0 }, false)} />
              </div>
            </Tray>
          );
        case 'score':
          return (
            <Tray title="Score (0-100)" onClose={close}>
              <div className="tp-form">
                <input className="input" type="number" min={0} max={100} value={Number(anyA.score)} onChange={(e) => setAction(t.id, ai, { score: Number(e.target.value) || 0 }, false)} />
              </div>
            </Tray>
          );
        case 'seconds':
          return (
            <Tray title="Jump to (seconds)" onClose={close}>
              <div className="tp-form">
                <input className="input" type="number" step={0.1} min={0} value={Number(anyA.seconds)} onChange={(e) => setAction(t.id, ai, { seconds: Number(e.target.value) || 0 }, false)} />
              </div>
            </Tray>
          );
        case 'url':
          return (
            <Tray title="URL to open" onClose={close}>
              <div className="tp-form">
                <input className="input" value={String(anyA.url ?? '')} placeholder="https://example.com" onChange={(e) => setAction(t.id, ai, { url: e.target.value }, false)} />
              </div>
            </Tray>
          );
        case 'code':
          return (
            <Tray title="JavaScript" onClose={close}>
              <div className="tp-form">
                <textarea
                  className="input textarea tp-code"
                  rows={7}
                  spellCheck={false}
                  value={String(anyA.code ?? '')}
                  placeholder={'forge.setVariable("score", 10);'}
                  onChange={(e) => setAction(t.id, ai, { code: e.target.value }, false)}
                />
                <p className="tp-tray-note">
                  Runs in the published course and in Preview, not on the editor canvas. Available:
                  forge.setVariable, getVariable, goToSlide, nextSlide, prevSlide, complete, and gsap.
                  Errors go to the browser console and never stop the course.
                </p>
              </div>
            </Tray>
          );
      }
    }
    return null;
  };

  // ---- render --------------------------------------------------------------------

  const isOpen = (tid: string, field: string, i?: number) => !!open && open.tid === tid && open.field === field && open.i === i;
  const errCount = issuesByTrigger.size;

  return (
    <div className="tp-root">
      <div className="tp-head">
        <div className="tp-head-row">
          <Lucide name="zap" size={14} className="tp-zap" />
          <span className="tp-label">Triggers</span>
          <span className="tp-count">{slide.triggers.length}</span>
          {errCount > 0 && (
            <span className="tp-badge-err">
              <Lucide name="triangle-alert" size={11} />{errCount === 1 ? '1 issue' : `${errCount} issues`}
            </span>
          )}
          <button type="button" className="tp-add" onClick={() => addTrigger()}>
            <Lucide name="plus" size={13} className="tp-add-icon" />Add
          </button>
        </div>
        <div className="tp-scope">Slide {slideIndex + 1} · {slide.name}</div>
      </div>

      <div className="tp-list">
        {slide.triggers.length === 0 && (
          <div className="tp-empty">
            <div className="tp-empty-icon"><Lucide name="zap" size={18} className="tp-zap" /></div>
            <div className="tp-empty-title">No triggers on this slide yet</div>
            <p className="tp-empty-text">Triggers make the slide respond to the learner: jump to a slide, show a layer, set a variable.</p>
            <button type="button" className="tp-primary" onClick={() => addTrigger()}>
              <Lucide name="plus" size={14} />Add trigger
            </button>
            <div className="tp-label tp-presets-label">Or start from</div>
            <div className="tp-presets">
              <button type="button" className="tp-preset" onClick={() => addTrigger('slide')}><Lucide name="mouse-pointer-click" size={14} />Click → go to slide</button>
              <button type="button" className="tp-preset" onClick={() => addTrigger('layer')}><Lucide name="layers" size={14} />Click → show layer</button>
              <button type="button" className="tp-preset" onClick={() => addTrigger('audio')}><Lucide name="volume-2" size={14} />Slide loads → play audio</button>
            </div>
          </div>
        )}

        {slide.triggers.map((t, ti) => {
          const ex = expanded === t.id;
          const subj = subjectName(t);
          const ev = EVENTS[t.event];
          const myIssues = issuesByTrigger.get(t.id) ?? [];
          const err = myIssues.length > 0;
          const enabled = t.enabled !== false;
          const a0 = t.actions[0];
          const extra = t.actions.length > 1 ? `  +${t.actions.length - 1}` : '';
          return (
            <div key={t.id} className={`tp-card${err ? ' err' : ''}${ex ? ' open' : ''}`}>
              <button type="button" className="tp-summary" aria-expanded={ex} onClick={() => { setExpanded(ex ? null : t.id); setOpen(null); }}>
                <Lucide name={err ? 'triangle-alert' : ev.icon} size={15} className={`tp-sum-icon${err ? ' err' : enabled ? ' on' : ''}`} />
                <span className={`tp-sum-text${enabled ? '' : ' off'}`}>
                  <strong>{subj.name}</strong> {ev.short} → {actionSummary(t, a0)}{extra}
                </span>
                {t.conditions.length > 0 && <span className="tp-tag" title="Has conditions">IF</span>}
                {!enabled && <span className="tp-tag solid">OFF</span>}
                <Lucide name={ex ? 'chevron-up' : 'chevron-down'} size={14} className="tp-sum-chev" />
              </button>
              {err && !ex && <div className="tp-err-line">{myIssues[0].message}{myIssues.length > 1 ? ` (+${myIssues.length - 1} more)` : ''}</div>}

              {ex && (
                <div className="tp-body">
                  <div className="tp-row">
                    <span className="tp-word">WHEN</span>
                    <div className="tp-chips">
                      <Chip icon={subj.icon} strong error={subj.bad} active={isOpen(t.id, 'subject')} onClick={() => toggleOpen(t.id, 'subject')}>{subj.name}</Chip>
                      <Chip chevron active={isOpen(t.id, 'event')} onClick={() => toggleOpen(t.id, 'event')}>{ev.label}</Chip>
                      {t.event === 'onKeyPress' && (
                        <Chip icon="keyboard" chevron active={isOpen(t.id, 'key')} onClick={() => toggleOpen(t.id, 'key')}>
                          {KEY_OPTIONS.find((k) => k.value === (t.key ?? 'Enter'))?.label ?? t.key}
                        </Chip>
                      )}
                      {t.event === 'onCuePoint' && (() => {
                        const c = slide.timeline?.cues?.find((x) => x.id === t.cueId);
                        return (
                          <Chip icon="flag" chevron error={!c} active={isOpen(t.id, 'cue')} onClick={() => toggleOpen(t.id, 'cue')}>
                            {c ? `${c.name} (${c.time.toFixed(1)}s)` : 'choose cue…'}
                          </Chip>
                        );
                      })()}
                      {t.event === 'onVariableChange' && (
                        <Chip icon="variable" chevron active={isOpen(t.id, 'watchVar')} onClick={() => toggleOpen(t.id, 'watchVar')}>
                          {(() => { const wv = variables.find((v) => v.id === t.watchVariableId); return wv ? variableLabel(project, wv) : 'any variable'; })()}
                        </Chip>
                      )}
                      {t.event === 'onStateAll' && (
                        <>
                          <Chip icon="list-checks" chevron error={!(t.watchBlockIds?.length)} active={isOpen(t.id, 'watchBlocks')} onClick={() => toggleOpen(t.id, 'watchBlocks')}>
                            {t.watchBlockIds?.length ? `${t.watchBlockIds.length} block${t.watchBlockIds.length === 1 ? '' : 's'}` : 'choose blocks…'}
                          </Chip>
                          <Chip chevron active={isOpen(t.id, 'watchState')} onClick={() => toggleOpen(t.id, 'watchState')}>→ {t.watchState ?? 'selected'}</Chip>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="tp-row">
                    <span className="tp-word">IF</span>
                    <div className="tp-chips center">
                      {t.conditions.map((c, ci) => {
                        const lab = condLabel(c);
                        return (
                          <span key={ci} className="tp-cond">
                            {ci > 0 && (
                              <button
                                type="button"
                                className="tp-joiner"
                                title="Switch between all conditions (AND) and any condition (OR)"
                                onClick={() => edit(t.id, (x) => { x.conditionLogic = x.conditionLogic === 'or' ? undefined : 'or'; })}
                              >{t.conditionLogic === 'or' ? 'OR' : 'AND'}</button>
                            )}
                            <Chip icon="split" error={lab.bad} active={isOpen(t.id, 'cond', ci)} onClick={() => toggleOpen(t.id, 'cond', ci)}>{lab.text}</Chip>
                          </span>
                        );
                      })}
                      <Chip
                        icon="plus" dashed
                        onClick={() => {
                          if (variables.length === 0 && blocks.length === 0) return;
                          const ci = t.conditions.length;
                          edit(t.id, (x) => {
                            const v = variables[0];
                            if (v) x.conditions.push({ variableId: v.id, operator: 'eq', value: defaultValueFor(v) });
                            else x.conditions.push({ variableId: '', blockId: blocks[0].block.id, blockState: 'visited', operator: 'eq' });
                          });
                          setOpen({ tid: t.id, field: 'cond', i: ci });
                        }}
                        title={variables.length === 0 && blocks.length === 0 ? 'Add a block or a variable first' : undefined}
                      >{t.conditions.length ? 'Condition' : 'Add condition (optional)'}</Chip>
                    </div>
                  </div>

                  {t.actions.map((a, ai) => {
                    const def = ACTIONS[a.type];
                    const issue = myIssues.find((x) => x.part === 'action' && x.index === ai && x.missing === 'deleted');
                    return (
                      <div key={ai} className="tp-row action">
                        <span className="tp-word">{ai ? 'AND' : 'THEN'}</span>
                        <div className="tp-chips">
                          <Chip icon={def.icon} strong active={isOpen(t.id, 'actType', ai)} onClick={() => toggleOpen(t.id, 'actType', ai)}>{def.verb}</Chip>
                          {def.params.map((p) => {
                            const pt = paramText(t, a, p);
                            return (
                              <Chip
                                key={p}
                                chevron={p !== 'code'}
                                dashed={pt.empty}
                                error={pt.deleted}
                                icon={pt.deleted ? 'triangle-alert' : undefined}
                                active={isOpen(t.id, `ap:${p}`, ai)}
                                onClick={() => toggleOpen(t.id, `ap:${p}`, ai)}
                              >
                                {pt.deleted ? <s>{pt.text}</s> : pt.text}
                              </Chip>
                            );
                          })}
                        </div>
                        <button type="button" className="tp-x" aria-label="Remove action" title="Remove action" onClick={() => { edit(t.id, (x) => { x.actions.splice(ai, 1); }); setOpen(null); }}>
                          <Lucide name="x" size={14} />
                        </button>
                        {issue && <div className="tp-row-err">{issue.message}</div>}
                      </div>
                    );
                  })}
                  <div className="tp-row">
                    <span className="tp-word">{t.actions.length ? '' : 'THEN'}</span>
                    <div className="tp-chips">
                      <Chip icon="plus" dashed active={isOpen(t.id, 'addAct')} onClick={() => toggleOpen(t.id, 'addAct')}>Add action</Chip>
                    </div>
                  </div>

                  {open && open.tid === t.id && renderTray(t, open)}

                  <div className="tp-foot">
                    <button type="button" className="tp-switch" role="switch" aria-checked={enabled} onClick={() => edit(t.id, (x) => { x.enabled = enabled ? false : undefined; })}>
                      <span className={`tp-switch-track${enabled ? ' on' : ''}`}><span className="tp-switch-knob" /></span>
                      {enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <span className="tp-foot-gap" />
                    <button type="button" className="tp-icon-btn" aria-label="Move up (triggers run top to bottom)" title="Move up. Triggers run top to bottom." disabled={ti === 0} onClick={() => move(t.id, -1)}><Lucide name="chevron-up" size={14} /></button>
                    <button type="button" className="tp-icon-btn" aria-label="Move down (triggers run top to bottom)" title="Move down. Triggers run top to bottom." disabled={ti === slide.triggers.length - 1} onClick={() => move(t.id, 1)}><Lucide name="chevron-down" size={14} /></button>
                    <button type="button" className="tp-icon-btn" aria-label="Duplicate trigger" title="Duplicate" onClick={() => duplicate(t.id)}><Lucide name="copy" size={14} /></button>
                    <button type="button" className="tp-icon-btn danger" aria-label="Delete trigger" title="Delete" onClick={() => remove(t.id)}><Lucide name="trash-2" size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tray({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="tp-tray">
      <div className="tp-tray-head">
        <span className="tp-tray-title">{title}</span>
        <button type="button" className="tp-icon-btn" aria-label="Close picker" onClick={onClose}><Lucide name="x" size={13} /></button>
      </div>
      <div className="tp-tray-body">{children}</div>
    </div>
  );
}

// Small helper reused by the variables panel to coerce typed defaults.
export { coerce as coerceVariableValue, defaultValueFor as defaultVariableValue, ValueInput };
