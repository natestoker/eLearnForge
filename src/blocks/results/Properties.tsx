import { LabelStyleFields } from '../../editor/LabelStyleFields';
import type { PropertiesRendererProps } from '../blockApi';
import type { ResultsProps } from '../../schema/types';
import { CheckboxInput, Field, NumberInput, SelectInput, TextArea, TextInput } from '../../editor/fields';

export function ResultsProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as ResultsProps;
  const set = (fn: (p: ResultsProps) => void) => onUpdateProps(fn);
  return (
    <>
      <Field label="Heading">
        <TextInput value={props.heading} onChange={(v) => set((p) => { p.heading = v; })} />
      </Field>
      <LabelStyleFields label="Heading" sizePlaceholder={16} value={props.labelStyle} onChange={(v) => set((p) => { p.labelStyle = v; })} />
      <Field label="Message when passed">
        <TextArea rows={2} value={props.passMessage} onChange={(v) => set((p) => { p.passMessage = v; })} />
      </Field>
      <Field label="Message when not passed">
        <TextArea rows={2} value={props.failMessage} onChange={(v) => set((p) => { p.failMessage = v; })} />
      </Field>
      <Field label="Message before a score exists">
        <TextArea rows={2} value={props.noScoreMessage} onChange={(v) => set((p) => { p.noScoreMessage = v; })} />
      </Field>
      <Field label="Score size">
        <NumberInput value={props.fontSize} min={24} max={160} onChange={(v) => set((p) => { p.fontSize = v; })} />
      </Field>
      <Field label="Align">
        <SelectInput
          value={props.align}
          options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
          onChange={(v) => set((p) => { p.align = v as ResultsProps['align']; })}
        />
      </Field>
      <CheckboxInput label="Show the pass mark" checked={props.showPassMark} onChange={(v) => set((p) => { p.showPassMark = v; })} />
      <p className="hint">
        Shows the course score and compares it with the pass mark set in Publish. Turn on
        Calculate from answers there, or use a Set score trigger, so there is a score to show.
      </p>
    </>
  );
}
