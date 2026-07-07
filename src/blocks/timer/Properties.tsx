import type { PropertiesRendererProps } from '../blockApi';
import type { TimerProps } from '../../schema/types';
import { CheckboxInput, ColorInput, Field, NumberInput, SelectInput } from '../../editor/fields';

export function TimerProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as TimerProps;
  return (
    <>
      <Field label="Mode">
        <SelectInput
          value={props.mode}
          options={[{ value: 'countdown', label: 'Count down' }, { value: 'countup', label: 'Count up' }]}
          onChange={(v) => onUpdateProps((p: TimerProps) => { p.mode = v as TimerProps['mode']; })}
        />
      </Field>
      {props.mode === 'countdown' && (
        <Field label="Start seconds">
          <NumberInput value={props.seconds} min={1} onChange={(v) => onUpdateProps((p: TimerProps) => { p.seconds = Math.max(1, v); })} />
        </Field>
      )}
      <Field label="Font size">
        <NumberInput value={props.fontSize} min={12} max={120} onChange={(v) => onUpdateProps((p: TimerProps) => { p.fontSize = v; })} />
      </Field>
      <Field label="Color">
        <ColorInput value={props.color ?? '#e7e9ec'} onChange={(v) => onUpdateProps((p: TimerProps) => { p.color = v; })} />
      </Field>
      <CheckboxInput label="Start automatically" checked={props.autoStart} onChange={(v) => onUpdateProps((p: TimerProps) => { p.autoStart = v; })} />
      {props.mode === 'countdown' && (
        <p className="hint">At zero, sets the boolean variable <code>timer_{block.id}_done</code> for triggers.</p>
      )}
    </>
  );
}
