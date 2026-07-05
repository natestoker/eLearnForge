import type { PropertiesRendererProps } from '../blockApi';
import type { TextEntryProps } from '../../schema/types';
import { textEntryVariableName } from '../../schema/factory';
import { CheckboxInput, Field, NumberInput, TextInput } from '../../editor/fields';

export function TextEntryProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as TextEntryProps;
  return (
    <>
      <Field label="Placeholder">
        <TextInput value={props.placeholder} onChange={(v) => onUpdateProps((p: TextEntryProps) => { p.placeholder = v; })} />
      </Field>
      <Field label="Font size">
        <NumberInput value={props.fontSize} onChange={(v) => onUpdateProps((p: TextEntryProps) => { p.fontSize = v; })} />
      </Field>
      <CheckboxInput label="Multiline" checked={props.multiline} onChange={(v) => onUpdateProps((p: TextEntryProps) => { p.multiline = v; })} />
      <p className="hint">Writes into the variable <code>{textEntryVariableName(block.id)}</code> as the learner types. Use a contains condition to react to answers.</p>
    </>
  );
}
