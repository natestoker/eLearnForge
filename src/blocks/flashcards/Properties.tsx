import type { PropertiesRendererProps } from '../blockApi';
import type { FlashcardsProps } from '../../schema/types';
import { Field, NumberInput, TextInput } from '../../editor/fields';
import { uid } from '../../schema/factory';

export function FlashcardsProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as FlashcardsProps;
  return (
    <>
      <Field label="Columns">
        <NumberInput value={props.columns} min={1} max={5} onChange={(v) => onUpdateProps((p: FlashcardsProps) => { p.columns = Math.max(1, Math.min(5, v)); })} />
      </Field>

      <h4 className="panel-subtitle">Cards (front / back)</h4>
      {props.cards.map((c, i) => (
        <div key={c.id} className="field-row">
          <TextInput value={c.front} onChange={(v) => onUpdateProps((p: FlashcardsProps) => { p.cards[i].front = v; })} />
          <TextInput value={c.back} onChange={(v) => onUpdateProps((p: FlashcardsProps) => { p.cards[i].back = v; })} />
          <button
            className="btn btn-ghost btn-icon btn-danger"
            title="Delete card"
            disabled={props.cards.length <= 1}
            onClick={() => onUpdateProps((p: FlashcardsProps) => { p.cards.splice(i, 1); })}
          >x</button>
        </div>
      ))}
      <button className="btn" onClick={() => onUpdateProps((p: FlashcardsProps) => { p.cards.push({ id: uid('fc'), front: 'New term', back: 'Its definition.' }); })}>+ Card</button>

      <p className="hint">When every card has been flipped once, sets the boolean <code>fc_{block.id}_done</code> for triggers.</p>
    </>
  );
}
