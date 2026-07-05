import type { PropertiesRendererProps } from '../blockApi';
import type { ImageProps, ShapeKind } from '../../schema/types';
import { Field, ImagePicker, SelectInput, TextInput } from '../../editor/fields';
import { SHAPE_LABELS } from '../shape/geometry';
import { useUiStore } from '../../state/uiStore';

export function ImageProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as ImageProps;
  const openPen = useUiStore((s) => s.openPenEditor);
  const clipValue = props.clipPoints ? '__custom' : (props.clipKind ?? '');
  return (
    <>
      <Field label="Image">
        <ImagePicker
          src={props.src}
          onChange={(src) => onUpdateProps((p: ImageProps) => { p.src = src; })}
        />
      </Field>
      <Field label="Fit">
        <SelectInput
          value={props.fit}
          options={[
            { value: 'contain', label: 'Contain' },
            { value: 'cover', label: 'Cover' }
          ]}
          onChange={(v) => onUpdateProps((p: ImageProps) => { p.fit = v as ImageProps['fit']; })}
        />
      </Field>
      <Field label="Clip to shape">
        <SelectInput
          value={clipValue}
          options={[
            { value: '', label: 'None (rectangle)' },
            ...(Object.keys(SHAPE_LABELS) as ShapeKind[])
              .filter((k) => k !== 'rectangle' && k !== 'roundedRectangle')
              .map((k) => ({ value: k, label: SHAPE_LABELS[k] })),
            ...(props.clipPoints ? [{ value: '__custom', label: 'Custom (pen)' }] : [])
          ]}
          onChange={(v) =>
            onUpdateProps((p: ImageProps) => {
              if (v === '__custom') return; // keep existing custom points
              p.clipKind = v ? (v as ShapeKind) : undefined;
              p.clipPoints = undefined;
            })
          }
        />
      </Field>
      <button
        className="btn"
        onClick={() => openPen(block.id, 'imageClip')}
        title="Draw a custom clip shape with the pen tool"
      >
        {props.clipPoints ? 'Edit custom clip (pen)' : 'Draw custom clip (pen)'}
      </button>
      {props.clipPoints && (
        <button className="btn btn-ghost" onClick={() => onUpdateProps((p: ImageProps) => { p.clipPoints = undefined; })}>
          Clear custom clip
        </button>
      )}
      <Field label="Alt text">
        <TextInput
          value={props.alt}
          placeholder="Describe the image for screen readers"
          onChange={(v) => onUpdateProps((p: ImageProps) => { p.alt = v; })}
        />
      </Field>
    </>
  );
}
