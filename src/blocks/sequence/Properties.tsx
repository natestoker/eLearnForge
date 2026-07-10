import type { PropertiesRendererProps } from '../blockApi';
import type { SequenceProps } from '../../schema/types';
import { Field, TextInput } from '../../editor/fields';
import { uid } from '../../schema/factory';

export function SequenceProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as SequenceProps;
  return (
    <>
      <Field label="Question">
        <TextInput value={props.question} onChange={(v) => onUpdateProps((p: SequenceProps) => { p.question = v; })} />
      </Field>

      <h4 className="panel-subtitle">Steps, in the correct order</h4>
      {props.items.map((it, i) => (
        <div key={it.id} className="field-row">
          <span className="seq-prop-num">{i + 1}</span>
          <TextInput value={it.text} onChange={(v) => onUpdateProps((p: SequenceProps) => { p.items[i].text = v; })} />
          <button className="btn btn-ghost btn-icon" title="Move up" disabled={i === 0}
            onClick={() => onUpdateProps((p: SequenceProps) => { [p.items[i - 1], p.items[i]] = [p.items[i], p.items[i - 1]]; })}>↑</button>
          <button className="btn btn-ghost btn-icon" title="Move down" disabled={i === props.items.length - 1}
            onClick={() => onUpdateProps((p: SequenceProps) => { [p.items[i + 1], p.items[i]] = [p.items[i], p.items[i + 1]]; })}>↓</button>
          <button className="btn btn-ghost btn-icon btn-danger" title="Delete step" disabled={props.items.length <= 2}
            onClick={() => onUpdateProps((p: SequenceProps) => { p.items.splice(i, 1); })}>x</button>
        </div>
      ))}
      <button className="btn" onClick={() => onUpdateProps((p: SequenceProps) => { p.items.push({ id: uid('seq'), text: 'New step' }); })}>+ Step</button>

      <div className="divider" />
      <Field label="Correct feedback">
        <TextInput value={props.feedbackCorrect} onChange={(v) => onUpdateProps((p: SequenceProps) => { p.feedbackCorrect = v; })} />
      </Field>
      <Field label="Incorrect feedback">
        <TextInput value={props.feedbackIncorrect} onChange={(v) => onUpdateProps((p: SequenceProps) => { p.feedbackIncorrect = v; })} />
      </Field>
      <p className="hint">The learner sees the steps shuffled. On Check, sets the boolean <code>seq_{block.id}_correct</code> for triggers.</p>
    </>
  );
}
