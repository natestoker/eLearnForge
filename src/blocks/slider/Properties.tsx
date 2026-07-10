import type { PropertiesRendererProps } from '../blockApi';
import type { SliderProps } from '../../schema/types';
import { CheckboxInput, Field, NumberInput, TextInput } from '../../editor/fields';

export function SliderProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as SliderProps;
  return (
    <>
      <Field label="Label">
        <TextInput value={props.label} onChange={(v) => onUpdateProps((p: SliderProps) => { p.label = v; })} />
      </Field>
      <Field label="Min">
        <NumberInput value={props.min} onChange={(v) => onUpdateProps((p: SliderProps) => { p.min = v; })} />
      </Field>
      <Field label="Max">
        <NumberInput value={props.max} onChange={(v) => onUpdateProps((p: SliderProps) => { p.max = v; })} />
      </Field>
      <Field label="Step">
        <NumberInput value={props.step} min={0.1} step={0.1} onChange={(v) => onUpdateProps((p: SliderProps) => { p.step = Math.max(0.1, v); })} />
      </Field>
      <Field label="Start value">
        <NumberInput value={props.defaultValue} onChange={(v) => onUpdateProps((p: SliderProps) => { p.defaultValue = v; })} />
      </Field>
      <CheckboxInput label="Show current value" checked={props.showValue} onChange={(v) => onUpdateProps((p: SliderProps) => { p.showValue = v; })} />
      <p className="hint">Writes the number variable <code>slider_{block.id}_value</code> on every change - pair with gt / lt / between trigger conditions.</p>
    </>
  );
}
