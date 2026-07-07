import type { PropertiesRendererProps } from '../blockApi';
import type { FillBlankProps } from '../../schema/types';
import { CheckboxInput, Field, NumberInput, TextArea, TextInput } from '../../editor/fields';

export function FillBlankProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as FillBlankProps;
  return (
    <>
      <Field label="Prompt (use ___ where the blank goes)">
        <TextArea value={props.question} rows={3} onChange={(v) => onUpdateProps((p: FillBlankProps) => { p.question = v; })} />
      </Field>
      <Field label="Accepted answers (comma-separated)">
        <TextInput
          value={props.correctAnswers.join(', ')}
          onChange={(v) => onUpdateProps((p: FillBlankProps) => { p.correctAnswers = v.split(',').map((s) => s.trim()).filter(Boolean); })}
        />
      </Field>
      <CheckboxInput label="Case sensitive" checked={props.caseSensitive ?? false} onChange={(v) => onUpdateProps((p: FillBlankProps) => { p.caseSensitive = v || undefined; })} />
      <Field label="Font size">
        <NumberInput value={props.fontSize} min={10} max={72} onChange={(v) => onUpdateProps((p: FillBlankProps) => { p.fontSize = v; })} />
      </Field>
      <Field label="Correct feedback">
        <TextInput value={props.feedbackCorrect} onChange={(v) => onUpdateProps((p: FillBlankProps) => { p.feedbackCorrect = v; })} />
      </Field>
      <Field label="Incorrect feedback">
        <TextInput value={props.feedbackIncorrect} onChange={(v) => onUpdateProps((p: FillBlankProps) => { p.feedbackIncorrect = v; })} />
      </Field>
      <p className="hint">On Check, sets the boolean variable <code>fb_{block.id}_correct</code> for triggers.</p>
    </>
  );
}
