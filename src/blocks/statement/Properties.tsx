import type { PropertiesRendererProps } from '../blockApi';
import type { StatementProps } from '../../schema/types';
import { Field, ImagePicker, TextArea, TextInput } from '../../editor/fields';

export function StatementProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as StatementProps;
  return (
    <>
      <Field label="Heading">
        <TextInput
          value={props.heading}
          onChange={(v) => onUpdateProps((p: StatementProps) => { p.heading = v; })}
        />
      </Field>
      <Field label="Body">
        <TextArea
          value={props.body}
          rows={5}
          onChange={(v) => onUpdateProps((p: StatementProps) => { p.body = v; })}
        />
      </Field>
      <Field label="Image (optional)">
        <ImagePicker
          src={props.imageSrc ?? ''}
          onChange={(src) => onUpdateProps((p: StatementProps) => { p.imageSrc = src || undefined; })}
        />
      </Field>
      <p className="hint">
        The Continue affordance fires this block's click event at runtime, so an
        "on click" trigger on this block can advance the slide or reveal a layer.
      </p>
    </>
  );
}
