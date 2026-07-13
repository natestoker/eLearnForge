import type { BlockState, ConditionOperator } from '../schema/types';
import type {
  Action, ActionType, Block, Slide, Trigger, Variable, VariableValue
} from '../schema/types';
import { useCurrentSlide, useProjectStore } from '../state/projectStore';
import { uid } from '../schema/factory';
import { SELF_TARGET } from '../schema/types';
import { SelectInput } from './fields';

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

// Trigger authoring, v1-thin to match the engine: one event, AND-ed equality
// conditions, a flat action list. No nesting, no JS action (v2 doors).

function blockLabel(b: Block): string {
  // Default label covers the v2 block types; specific cases add detail.
  const short = (s: string) => (s.length > 26 ? `${s.slice(0, 26)}...` : s);
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
      return `MC: ${short((b.props as { question: string }).question)}`;
    default:
      return `${b.type.charAt(0).toUpperCase()}${b.type.slice(1)} block`;
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

export function TriggersPanel() {
  const slide = useCurrentSlide();
  const project = useProjectStore((s) => s.project);
  const mutate = useProjectStore((s) => s.mutate);

  const blocks = slideBlocks(slide);
  const audioBlocks = blocks.filter(({ block }) => block.type === 'audio');
  const variables = project.variables;

  // Block-target dropdown options. When the trigger fires on an object
  // (onClick/onHover/onBlockEnters/...), offer "This object" up top - the
  // Storyline self-target - so an action can act on the same block that
  // triggered it without naming it explicitly.
  const blockTargetOptions = (trigger: Trigger, from = blocks) => {
    const opts = from.map(({ block, layerName }) => ({
      value: block.id,
      label: `${blockLabel(block)} (${layerName})`
    }));
    return trigger.sourceBlockId
      ? [{ value: SELF_TARGET, label: '↻ This object (the source)' }, ...opts]
      : opts;
  };

  const edit = (triggerId: string, fn: (t: Trigger) => void, history = true) =>
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      const t = s?.triggers.find((tr) => tr.id === triggerId);
      if (t) fn(t);
    }, history);

  const addTrigger = () =>
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      s?.triggers.push({
        id: uid('trg'),
        event: 'onClick',
        sourceBlockId: blocks[0]?.block.id,
        conditions: [],
        actions: []
      });
    });

  const defaultAction = (type: ActionType): Action => {
    switch (type) {
      case 'showLayer': return { type, layerId: slide.layers[slide.layers.length - 1]?.id ?? '' };
      case 'hideLayer': return { type, layerId: slide.layers[slide.layers.length - 1]?.id ?? '' };
      case 'showBlock': return { type, blockId: blocks[0]?.block.id ?? '' };
      case 'hideBlock': return { type, blockId: blocks[0]?.block.id ?? '' };
      case 'goToSlide': return { type, slideId: project.slides[0].id };
      case 'setVariable': {
        const v = variables[0];
        return { type, variableId: v?.id ?? '', value: defaultValueFor(v) };
      }
      case 'adjustVariable': {
        const v = variables.find((vr) => vr.type === 'number') ?? variables[0];
        return { type, variableId: v?.id ?? '', delta: 1 };
      }
      case 'completeCourse': return { type };
      case 'setScore': return { type, score: 100 };
      case 'setState': return { type, blockId: blocks[0]?.block.id ?? '', state: 'selected' };
      case 'setPlayerButton': return { type, button: 'next', enabled: false };
      case 'playAudio': return { type, blockId: audioBlocks[0]?.block.id ?? blocks[0]?.block.id ?? '' };
      case 'pauseAudio': return { type, blockId: audioBlocks[0]?.block.id ?? blocks[0]?.block.id ?? '' };
      case 'pulseBlock': return { type, blockId: blocks[0]?.block.id ?? '', emphasis: 'pulse' };
      case 'playMotion': return { type, blockId: blocks[0]?.block.id ?? '' };
      case 'pauseTimeline': return { type };
      case 'resumeTimeline': return { type };
      case 'seekTimeline': return { type, seconds: 0 };
      case 'openUrl': return { type, url: 'https://' };
      case 'toggleBlock': return { type, blockId: blocks[0]?.block.id ?? '' };
      case 'restartTimeline': return { type };
    }
  };

  return (
    <div className="panel-scroll">
      <div className="panel-title-row">
        <h3 className="panel-title">Slide triggers</h3>
        <button className="btn btn-accent" onClick={addTrigger}>+ Trigger</button>
      </div>
      <p className="hint">
        Triggers belong to this slide: {slide.name}. Sources and targets can be
        blocks on ANY layer (the dropdowns show each block's layer).
      </p>

      {slide.triggers.length === 0 && (
        <p className="empty-note">No triggers yet. Add one to make this slide react.</p>
      )}

      {slide.triggers.map((trigger, ti) => (
        <div key={trigger.id} className="trigger-card">
          <div className="trigger-card-head">
            <span className="trigger-index">{ti + 1}</span>
            <SelectInput
              value={trigger.event}
              options={[
                { value: 'onClick', label: 'When block is clicked' },
                { value: 'onHover', label: 'When block is hovered (mouse enter)' },
                { value: 'onMouseLeave', label: 'When block is un-hovered (mouse leave)' },
                { value: 'onDoubleClick', label: 'When block is double-clicked' },
                { value: 'onSlideLoad', label: 'When slide loads' },
                { value: 'onVariableChange', label: 'When variable changes' },
                { value: 'onTimelineEnd', label: 'When the timeline ends' },
                { value: 'onBlockEnters', label: 'When an object enters the frame' },
                { value: 'onAnimationComplete', label: 'When an animation completes' },
                { value: 'onStateAll', label: 'When the state of all of...' },
                { value: 'onCuePoint', label: 'When the timeline reaches a cue' },
                { value: 'onSubmit', label: 'When Submit is pressed' }
              ]}
              onChange={(v) =>
                edit(trigger.id, (t) => {
                  t.event = v as Trigger['event'];
                  const needsSource = t.event === 'onClick' || t.event === 'onHover' || t.event === 'onMouseLeave' || t.event === 'onDoubleClick';
                  if (needsSource && !t.sourceBlockId) t.sourceBlockId = blocks[0]?.block.id;
                  if (!needsSource) t.sourceBlockId = undefined;
                  if (t.event !== 'onVariableChange') t.watchVariableId = undefined;
                })
              }
            />
            <button
              className="btn btn-ghost btn-icon btn-danger"
              title="Delete trigger"
              onClick={() =>
                mutate((p) => {
                  const s = p.slides.find((sl) => sl.id === slide.id);
                  if (s) s.triggers = s.triggers.filter((t) => t.id !== trigger.id);
                })
              }
            >
              x
            </button>
          </div>

          {(trigger.event === 'onClick' || trigger.event === 'onHover' || trigger.event === 'onDoubleClick' || trigger.event === 'onBlockEnters' || trigger.event === 'onAnimationComplete') && (
            <div className="trigger-row">
              <span className="trigger-label">Source</span>
              <SelectInput
                value={trigger.sourceBlockId ?? ''}
                options={blocks.map(({ block, layerName }) => ({
                  value: block.id,
                  label: `${blockLabel(block)} (${layerName})`
                }))}
                onChange={(v) => edit(trigger.id, (t) => { t.sourceBlockId = v; })}
              />
            </div>
          )}

          {trigger.event === 'onStateAll' && (
            <>
              <div className="trigger-row">
                <span className="trigger-label">State</span>
                <SelectInput
                  value={trigger.watchState ?? 'selected'}
                  options={(['selected', 'visited', 'disabled', 'hidden', 'normal'] as const).map((s) => ({ value: s, label: s }))}
                  onChange={(v) => edit(trigger.id, (t) => { t.watchState = v as BlockState; })}
                />
              </div>
              <div className="trigger-row state-all-blocks">
                <span className="trigger-label">Of all</span>
                <div className="check-list">
                  {blocks.map(({ block, layerName }) => (
                    <label key={block.id} className="check-item">
                      <input
                        type="checkbox"
                        checked={trigger.watchBlockIds?.includes(block.id) ?? false}
                        onChange={(e) =>
                          edit(trigger.id, (t) => {
                            const set = new Set(t.watchBlockIds ?? []);
                            if (e.target.checked) set.add(block.id);
                            else set.delete(block.id);
                            t.watchBlockIds = [...set];
                          })
                        }
                      />
                      {blockLabel(block)} ({layerName})
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {trigger.event === 'onVariableChange' && (
            <div className="trigger-row">
              <span className="trigger-label">Watch</span>
              <SelectInput
                value={trigger.watchVariableId ?? ''}
                options={[
                  { value: '', label: 'Any variable' },
                  ...variables.map((v) => ({ value: v.id, label: v.name }))
                ]}
                onChange={(v) => edit(trigger.id, (t) => { t.watchVariableId = v || undefined; })}
              />
            </div>
          )}

          {trigger.event === 'onCuePoint' && (
            <div className="trigger-row">
              <span className="trigger-label">Cue</span>
              {(slide.timeline?.cues ?? []).length === 0 ? (
                <span className="hint">Add a cue on the timeline ruler first (right-click the ruler).</span>
              ) : (
                <SelectInput
                  value={trigger.cueId ?? slide.timeline!.cues![0].id}
                  options={(slide.timeline?.cues ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.time.toFixed(1)}s)` }))}
                  onChange={(v) => edit(trigger.id, (t) => { t.cueId = v; })}
                />
              )}
            </div>
          )}

          <div className="trigger-section">
            <div className="trigger-section-head">
              <span>If</span>
              {trigger.conditions.length > 1 && (
                <SelectInput
                  value={trigger.conditionLogic ?? 'and'}
                  options={[{ value: 'and', label: 'all are true (AND)' }, { value: 'or', label: 'any is true (OR)' }]}
                  onChange={(v) => edit(trigger.id, (t) => { t.conditionLogic = v === 'or' ? 'or' : undefined; })}
                />
              )}
              <button
                className="btn btn-ghost"
                disabled={variables.length === 0}
                title={variables.length === 0 ? 'Create a variable first' : 'Add condition'}
                onClick={() =>
                  edit(trigger.id, (t) => {
                    const v = variables[0];
                    t.conditions.push({ variableId: v.id, operator: 'eq', value: defaultValueFor(v) });
                  })
                }
              >
                + condition
              </button>
            </div>
            {trigger.conditions.map((cond, ci) => {
              const variable = variables.find((v) => v.id === cond.variableId);
              return (
                <div key={ci} className="trigger-row">
                  <SelectInput
                    value={cond.variableId}
                    options={variables.map((v) => ({ value: v.id, label: v.name }))}
                    onChange={(raw) =>
                      edit(trigger.id, (t) => {
                        const nv = variables.find((v) => v.id === raw);
                        t.conditions[ci].variableId = raw;
                        t.conditions[ci].value = defaultValueFor(nv);
                        delete t.conditions[ci].equals;
                      })
                    }
                  />
                  <SelectInput
                    value={cond.operator ?? 'eq'}
                    options={OPERATORS.filter((o) => o.types.includes(variable?.type ?? 'string'))
                      .map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(v) =>
                      edit(trigger.id, (t) => {
                        t.conditions[ci].operator = v as ConditionOperator;
                      })
                    }
                  />
                  {/* isEmpty/notEmpty need no value; between needs two. */}
                  {cond.operator !== 'isEmpty' && cond.operator !== 'notEmpty' && (
                    <ValueInput
                      variable={variable}
                      value={(cond.value !== undefined ? cond.value : cond.equals) ?? ''}
                      onChange={(v) => edit(trigger.id, (t) => { t.conditions[ci].value = v; delete t.conditions[ci].equals; })}
                    />
                  )}
                  {cond.operator === 'between' && (
                    <>
                      <span className="trigger-label">and</span>
                      <ValueInput
                        variable={variable}
                        value={cond.value2 ?? ''}
                        onChange={(v) => edit(trigger.id, (t) => { t.conditions[ci].value2 = v; })}
                      />
                    </>
                  )}
                  <button
                    className="btn btn-ghost btn-icon btn-danger"
                    onClick={() => edit(trigger.id, (t) => { t.conditions.splice(ci, 1); })}
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>

          <div className="trigger-section">
            <div className="trigger-section-head">
              <span>Then</span>
              <button
                className="btn btn-ghost"
                onClick={() => edit(trigger.id, (t) => { t.actions.push(defaultAction('showLayer')); })}
              >
                + action
              </button>
            </div>
            {trigger.actions.map((action, ai) => (
              <div key={ai} className="trigger-row">
                <SelectInput
                  value={action.type}
                  options={[
                    { value: 'showLayer', label: 'Show layer' },
                    { value: 'hideLayer', label: 'Hide layer' },
                    { value: 'showBlock', label: 'Show block' },
                    { value: 'hideBlock', label: 'Hide block' },
                    { value: 'goToSlide', label: 'Go to slide' },
                    { value: 'setVariable', label: 'Set variable' },
                    { value: 'adjustVariable', label: 'Adjust variable by' },
                    { value: 'completeCourse', label: 'Complete course' },
                    { value: 'setScore', label: 'Set score' },
                    { value: 'setState', label: 'Set block state' },
                    { value: 'setPlayerButton', label: 'Enable/disable player button' },
                    { value: 'playAudio', label: 'Play audio' },
                    { value: 'pauseAudio', label: 'Pause audio' },
                    { value: 'pulseBlock', label: 'Pulse / emphasize a block' },
                    { value: 'playMotion', label: 'Play motion path' },
                    { value: 'pauseTimeline', label: 'Pause the timeline' },
                    { value: 'resumeTimeline', label: 'Resume the timeline' },
                    { value: 'seekTimeline', label: 'Jump the timeline to...' },
                    { value: 'restartTimeline', label: 'Restart the timeline' },
                    { value: 'toggleBlock', label: 'Toggle block visibility' },
                    { value: 'openUrl', label: 'Open URL' }
                  ]}
                  onChange={(v) =>
                    edit(trigger.id, (t) => { t.actions[ai] = defaultAction(v as ActionType); })
                  }
                />
                {(action.type === 'showLayer' || action.type === 'hideLayer') && (
                  <SelectInput
                    value={action.layerId}
                    options={slide.layers.map((l) => ({ value: l.id, label: l.name }))}
                    onChange={(v) =>
                      edit(trigger.id, (t) => {
                        (t.actions[ai] as { layerId: string }).layerId = v;
                      })
                    }
                  />
                )}
                {action.type === 'openUrl' && (
                  <input
                    className="input"
                    value={action.url}
                    placeholder="https://example.com"
                    onChange={(e) =>
                      edit(trigger.id, (t) => {
                        (t.actions[ai] as { url: string }).url = e.target.value;
                      }, false)
                    }
                  />
                )}
                {(action.type === 'showBlock' || action.type === 'hideBlock' || action.type === 'toggleBlock') && (
                  <SelectInput
                    value={action.blockId}
                    options={blockTargetOptions(trigger)}
                    onChange={(v) =>
                      edit(trigger.id, (t) => {
                        (t.actions[ai] as { blockId: string }).blockId = v;
                      })
                    }
                  />
                )}
                {action.type === 'goToSlide' && (
                  <SelectInput
                    value={action.slideId}
                    options={project.slides.map((s, i) => ({ value: s.id, label: `${i + 1}. ${s.name}` }))}
                    onChange={(v) =>
                      edit(trigger.id, (t) => {
                        (t.actions[ai] as { slideId: string }).slideId = v;
                      })
                    }
                  />
                )}
                {action.type === 'setVariable' && variables.length === 0 && (
                  <span className="hint">No variables yet — create one in the Variables tab, then pick it and its new value here.</span>
                )}
                {action.type === 'setVariable' && variables.length > 0 && (
                  <>
                    <SelectInput
                      value={action.variableId}
                      options={variables.map((v) => ({ value: v.id, label: v.name }))}
                      onChange={(raw) =>
                        edit(trigger.id, (t) => {
                          const nv = variables.find((v) => v.id === raw);
                          const a = t.actions[ai] as { variableId: string; value: VariableValue };
                          a.variableId = raw;
                          a.value = defaultValueFor(nv);
                        })
                      }
                    />
                    <ValueInput
                      variable={variables.find((v) => v.id === action.variableId)}
                      value={action.value}
                      onChange={(v) =>
                        edit(trigger.id, (t) => {
                          (t.actions[ai] as { value: VariableValue }).value = v;
                        })
                      }
                    />
                  </>
                )}
                {action.type === 'adjustVariable' && (
                  <>
                    <SelectInput
                      value={action.variableId}
                      options={variables.map((v) => ({ value: v.id, label: v.name }))}
                      onChange={(v) =>
                        edit(trigger.id, (t) => {
                          (t.actions[ai] as { variableId: string }).variableId = v;
                        })
                      }
                    />
                    <input
                      className="input trigger-number"
                      type="number"
                      value={action.delta}
                      onChange={(e) =>
                        edit(trigger.id, (t) => {
                          (t.actions[ai] as { delta: number }).delta = Number(e.target.value) || 0;
                        })
                      }
                    />
                  </>
                )}
                {action.type === 'setScore' && (
                  <input
                    className="input trigger-number"
                    type="number"
                    min={0}
                    max={100}
                    value={action.score}
                    onChange={(e) =>
                      edit(trigger.id, (t) => {
                        (t.actions[ai] as { score: number }).score = Number(e.target.value) || 0;
                      })
                    }
                  />
                )}
                {action.type === 'setState' && (
                  <>
                    <SelectInput
                      value={action.blockId}
                      options={blockTargetOptions(trigger)}
                      onChange={(v) => edit(trigger.id, (t) => { (t.actions[ai] as { blockId: string }).blockId = v; })}
                    />
                    <SelectInput
                      value={action.state}
                      options={(['normal', 'selected', 'visited', 'disabled', 'hidden'] as const).map((s) => ({ value: s, label: s }))}
                      onChange={(v) => edit(trigger.id, (t) => { (t.actions[ai] as { state: BlockState }).state = v as BlockState; })}
                    />
                  </>
                )}
                {action.type === 'setPlayerButton' && (
                  <>
                    <SelectInput
                      value={action.button}
                      options={(['next', 'back', 'submit'] as const).map((bt) => ({ value: bt, label: bt }))}
                      onChange={(v) => edit(trigger.id, (t) => { (t.actions[ai] as { button: string }).button = v; })}
                    />
                    <SelectInput
                      value={String(action.enabled)}
                      options={[{ value: 'true', label: 'enable' }, { value: 'false', label: 'disable' }]}
                      onChange={(v) => edit(trigger.id, (t) => { (t.actions[ai] as { enabled: boolean }).enabled = v === 'true'; })}
                    />
                  </>
                )}
                {(action.type === 'playAudio' || action.type === 'pauseAudio') && (
                  <SelectInput
                    value={action.blockId}
                    options={blockTargetOptions(trigger, audioBlocks.length ? audioBlocks : blocks)}
                    onChange={(v) => edit(trigger.id, (t) => { (t.actions[ai] as { blockId: string }).blockId = v; })}
                  />
                )}
                {action.type === 'playMotion' && (
                  <SelectInput
                    value={action.blockId}
                    options={blockTargetOptions(trigger)}
                    onChange={(v) => edit(trigger.id, (t) => { (t.actions[ai] as { blockId: string }).blockId = v; })}
                  />
                )}
                {action.type === 'pulseBlock' && (
                  <>
                    <SelectInput
                      value={action.blockId}
                      options={blockTargetOptions(trigger)}
                      onChange={(v) => edit(trigger.id, (t) => { (t.actions[ai] as { blockId: string }).blockId = v; })}
                    />
                    <SelectInput
                      value={action.emphasis}
                      options={(['pulse', 'bounce', 'shake', 'float'] as const).map((s) => ({ value: s, label: s }))}
                      onChange={(v) => edit(trigger.id, (t) => { (t.actions[ai] as { emphasis: string }).emphasis = v; })}
                    />
                  </>
                )}
                {action.type === 'seekTimeline' && (
                  <input
                    className="input"
                    type="number"
                    step={0.1}
                    min={0}
                    value={action.seconds}
                    onChange={(e) => edit(trigger.id, (t) => { (t.actions[ai] as { seconds: number }).seconds = Number(e.target.value) || 0; })}
                    style={{ width: 90 }}
                  />
                )}
                <button
                  className="btn btn-ghost btn-icon btn-danger"
                  onClick={() => edit(trigger.id, (t) => { t.actions.splice(ai, 1); })}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Small helper reused by the variables panel to coerce typed defaults.
export { coerce as coerceVariableValue, defaultValueFor as defaultVariableValue, ValueInput };
