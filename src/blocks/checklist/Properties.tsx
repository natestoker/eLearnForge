import type { PropertiesRendererProps } from '../blockApi';
import type { ChecklistProps } from '../../schema/types';
import { Field, TextInput } from '../../editor/fields';
import { uid } from '../../schema/factory';

export function ChecklistProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as ChecklistProps;
  return (
    <>
      <Field label="Title">
        <TextInput value={props.title} onChange={(v) => onUpdateProps((p: ChecklistProps) => { p.title = v; })} />
      </Field>

      <h4 className="panel-subtitle">Items</h4>
      {props.items.map((it, i) => (
        <div key={it.id} className="field-row">
          <TextInput value={it.text} onChange={(v) => onUpdateProps((p: ChecklistProps) => { p.items[i].text = v; })} />
          <button className="btn btn-ghost btn-icon btn-danger" title="Delete item" disabled={props.items.length <= 1}
            onClick={() => onUpdateProps((p: ChecklistProps) => { p.items.splice(i, 1); })}>x</button>
        </div>
      ))}
      <button className="btn" onClick={() => onUpdateProps((p: ChecklistProps) => { p.items.push({ id: uid('cl'), text: 'New item' }); })}>+ Item</button>

      <p className="hint">All items checked sets the boolean <code>cl_{block.id}_done</code>; unchecking clears it.</p>
    </>
  );
}
