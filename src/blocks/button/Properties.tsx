import type { PropertiesRendererProps } from '../blockApi';
import type { ButtonProps } from '../../schema/types';
import { ColorInput, Field, NumberInput, Row, SelectInput, TextInput } from '../../editor/fields';

export function ButtonProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as ButtonProps;
  return (
    <>
      <Field label="Label">
        <TextInput value={props.label} onChange={(v) => onUpdateProps((p: ButtonProps) => { p.label = v; })} />
      </Field>
      <Row>
        <Field label="Style">
          <SelectInput
            value={props.variant}
            options={[{ value: 'solid', label: 'Solid' }, { value: 'outline', label: 'Outline' }]}
            onChange={(v) => onUpdateProps((p: ButtonProps) => { p.variant = v as ButtonProps['variant']; })}
          />
        </Field>
        <Field label="Font size">
          <NumberInput value={props.fontSize} onChange={(v) => onUpdateProps((p: ButtonProps) => { p.fontSize = v; })} />
        </Field>
      </Row>
      <Row>
        <Field label="Fill">
          <ColorInput value={props.fill ?? '#3ddc97'} onChange={(v) => onUpdateProps((p: ButtonProps) => { p.fill = v; })} />
        </Field>
        <Field label="Text">
          <ColorInput value={props.textColor ?? ''} onChange={(v) => onUpdateProps((p: ButtonProps) => { p.textColor = v || undefined; })} />
        </Field>
      </Row>
      <p className="hint">Buttons are trigger sources. Add an On click trigger on the Triggers tab and pick this block.</p>
    </>
  );
}
