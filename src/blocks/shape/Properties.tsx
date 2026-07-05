import type { PropertiesRendererProps } from '../blockApi';
import type { ShapeKind, ShapeProps } from '../../schema/types';
import { ColorInput, Field, NumberInput, Row, SelectInput } from '../../editor/fields';
import { SHAPE_LABELS } from './geometry';
import { useUiStore } from '../../state/uiStore';

export function ShapeProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as ShapeProps;
  const openPen = useUiStore((s) => s.openPenEditor);
  return (
    <>
      <Field label="Shape">
        <SelectInput
          value={props.points ? '__custom' : props.kind}
          options={[
            ...(Object.keys(SHAPE_LABELS) as ShapeKind[]).map((k) => ({ value: k, label: SHAPE_LABELS[k] })),
            ...(props.points ? [{ value: '__custom', label: 'Custom (pen)' }] : [])
          ]}
          onChange={(v) => onUpdateProps((p: ShapeProps) => { if (v !== '__custom') { p.kind = v as ShapeKind; p.points = undefined; } })}
        />
      </Field>
      <button className="btn" onClick={() => openPen(block.id, 'shape')} title="Draw or edit a custom shape with the pen tool">
        {props.points ? 'Edit custom shape (pen)' : 'Draw custom shape (pen)'}
      </button>
      <Field label="Fill">
        <ColorInput value={props.fill} onChange={(v) => onUpdateProps((p: ShapeProps) => { p.fill = v; })} />
      </Field>
      <Field label="Border">
        <ColorInput value={props.borderColor} onChange={(v) => onUpdateProps((p: ShapeProps) => { p.borderColor = v; })} />
      </Field>
      <Row>
        <Field label="Border width">
          <NumberInput value={props.borderWidth} onChange={(v) => onUpdateProps((p: ShapeProps) => { p.borderWidth = Math.max(0, v); })} />
        </Field>
        <Field label="Corner radius">
          <NumberInput value={props.cornerRadius} onChange={(v) => onUpdateProps((p: ShapeProps) => { p.cornerRadius = Math.max(0, v); })} />
        </Field>
      </Row>
    </>
  );
}
