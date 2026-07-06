import type { PropertiesRendererProps } from '../blockApi';
import type { ShapeProps } from '../../schema/types';
import { ColorInput, Field, NumberInput, Row } from '../../editor/fields';
import { SHAPE_LABELS } from './geometry';
import { ShapePicker } from './ShapePicker';
import { useUiStore } from '../../state/uiStore';

export function ShapeProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as ShapeProps;
  const openPen = useUiStore((s) => s.openPenEditor);
  return (
    <>
      <Field label={`Shape: ${props.points ? 'Custom (pen)' : SHAPE_LABELS[props.kind]}`}>
        <ShapePicker
          value={props.points ? null : props.kind}
          onPick={(kind) => onUpdateProps((p: ShapeProps) => { p.kind = kind; p.points = undefined; })}
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
