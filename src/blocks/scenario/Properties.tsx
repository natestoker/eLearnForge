import type { PropertiesRendererProps } from '../blockApi';
import type { ScenarioProps } from '../../schema/types';
import { Field, SelectInput, TextInput } from '../../editor/fields';
import { uid } from '../../schema/factory';

// Passage editor: flat list; passages[0] is the start. Choices target any
// passage or "End scenario" (empty target). A passage with no choices is an
// ending screen.
export function ScenarioProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as ScenarioProps;
  const passageOptions = (selfId: string) => [
    { value: '', label: '(End scenario)' },
    ...props.passages
      .filter((p) => p.id !== selfId)
      .map((p, i) => ({ value: p.id, label: `${props.passages.indexOf(p) + 1} · ${p.text.slice(0, 28) || 'untitled'}` }))
  ];
  return (
    <>
      {props.passages.map((psg, pi) => (
        <div key={psg.id} className="sc-prop-passage">
          <div className="field-row">
            <span className="seq-prop-num">{pi + 1}</span>
            <TextInput value={psg.speaker ?? ''} placeholder="Speaker (optional)"
              onChange={(v) => onUpdateProps((p: ScenarioProps) => { p.passages[pi].speaker = v || undefined; })} />
            <button className="btn btn-ghost btn-icon btn-danger" title="Delete passage"
              disabled={props.passages.length <= 1 || pi === 0}
              onClick={() => onUpdateProps((p: ScenarioProps) => {
                const removed = p.passages[pi].id;
                p.passages.splice(pi, 1);
                p.passages.forEach((q) => q.choices.forEach((c) => { if (c.targetId === removed) c.targetId = ''; }));
              })}>x</button>
          </div>
          <TextInput value={psg.text} placeholder="Passage text"
            onChange={(v) => onUpdateProps((p: ScenarioProps) => { p.passages[pi].text = v; })} />
          {psg.choices.map((c, ci) => (
            <div key={c.id} className="field-row sc-prop-choice">
              <TextInput value={c.label} placeholder="Choice label"
                onChange={(v) => onUpdateProps((p: ScenarioProps) => { p.passages[pi].choices[ci].label = v; })} />
              <SelectInput
                value={c.targetId}
                options={passageOptions(psg.id)}
                onChange={(v) => onUpdateProps((p: ScenarioProps) => { p.passages[pi].choices[ci].targetId = v; })}
              />
              <button className="btn btn-ghost btn-icon btn-danger" title="Delete choice"
                onClick={() => onUpdateProps((p: ScenarioProps) => { p.passages[pi].choices.splice(ci, 1); })}>x</button>
            </div>
          ))}
          <button className="btn" style={{ fontSize: 11 }}
            onClick={() => onUpdateProps((p: ScenarioProps) => { p.passages[pi].choices.push({ id: uid('cho'), label: 'New choice', targetId: '' }); })}>
            + Choice
          </button>
          <div className="divider" />
        </div>
      ))}
      <button className="btn" onClick={() => onUpdateProps((p: ScenarioProps) => { p.passages.push({ id: uid('psg'), text: 'New passage', choices: [] }); })}>+ Passage</button>
      <p className="hint">Passage 1 is the start; a passage with no choices ends the scenario and sets <code>sc_{block.id}_done</code>. The taken path is reported for tracking.</p>
    </>
  );
}
