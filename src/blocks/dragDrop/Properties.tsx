import type { PropertiesRendererProps } from '../blockApi';
import type { DragDropProps } from '../../schema/types';
import { Field, SelectInput, TextInput } from '../../editor/fields';
import { uid } from '../../schema/factory';

export function DragDropProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as DragDropProps;
  return (
    <>
      <Field label="Question">
        <TextInput value={props.question} onChange={(v) => onUpdateProps((p: DragDropProps) => { p.question = v; })} />
      </Field>

      <h4 className="panel-subtitle">Groups (drop targets)</h4>
      {props.targets.map((t, i) => (
        <div key={t.id} className="field-row">
          <TextInput value={t.label} onChange={(v) => onUpdateProps((p: DragDropProps) => { p.targets[i].label = v; })} />
          <button
            className="btn btn-ghost btn-icon btn-danger"
            title="Delete group"
            disabled={props.targets.length <= 1}
            onClick={() => onUpdateProps((p: DragDropProps) => {
              const removed = p.targets[i].id;
              p.targets.splice(i, 1);
              // Reassign any items that pointed at the removed group.
              p.items.forEach((it) => { if (it.targetId === removed) it.targetId = p.targets[0].id; });
            })}
          >x</button>
        </div>
      ))}
      <button className="btn" onClick={() => onUpdateProps((p: DragDropProps) => { p.targets.push({ id: uid('tgt'), label: 'New group' }); })}>+ Group</button>

      <h4 className="panel-subtitle">Items (and their correct group)</h4>
      {props.items.map((it, i) => (
        <div key={it.id} className="field-row">
          <TextInput value={it.text} onChange={(v) => onUpdateProps((p: DragDropProps) => { p.items[i].text = v; })} />
          <SelectInput
            value={it.targetId}
            options={props.targets.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(v) => onUpdateProps((p: DragDropProps) => { p.items[i].targetId = v; })}
          />
          <button className="btn btn-ghost btn-icon btn-danger" title="Delete item" onClick={() => onUpdateProps((p: DragDropProps) => { p.items.splice(i, 1); })}>x</button>
        </div>
      ))}
      <button className="btn" onClick={() => onUpdateProps((p: DragDropProps) => { p.items.push({ id: uid('itm'), text: 'New item', targetId: p.targets[0].id }); })}>+ Item</button>

      <div className="divider" />
      <Field label="Correct feedback">
        <TextInput value={props.feedbackCorrect} onChange={(v) => onUpdateProps((p: DragDropProps) => { p.feedbackCorrect = v; })} />
      </Field>
      <Field label="Incorrect feedback">
        <TextInput value={props.feedbackIncorrect} onChange={(v) => onUpdateProps((p: DragDropProps) => { p.feedbackIncorrect = v; })} />
      </Field>
      <p className="hint">On Check, sets the boolean <code>dd_{block.id}_correct</code> for triggers.</p>
    </>
  );
}
