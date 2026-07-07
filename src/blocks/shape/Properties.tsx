import type { PropertiesRendererProps } from '../blockApi';
import type { LineEndSize, LineEndType, ShapeProps } from '../../schema/types';
import { ButtonField, ColorInput, Field, NumberInput, Row, SelectInput } from '../../editor/fields';
import { SHAPE_LABELS } from './geometry';
import { ShapePicker } from './ShapePicker';
import { useUiStore } from '../../state/uiStore';

const END_TYPES: { value: LineEndType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'stealth', label: 'Stealth' },
  { value: 'open', label: 'Open arrow' },
  { value: 'oval', label: 'Oval' },
  { value: 'diamond', label: 'Diamond' }
];
const END_SIZES: { value: LineEndSize; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' }
];

// PowerPoint-style begin/end arrow controls for line shapes.
function LineEndControls({ label, propKey, props, onUpdateProps }: {
  label: string;
  propKey: 'lineStart' | 'lineEnd';
  props: ShapeProps;
  onUpdateProps: PropertiesRendererProps['onUpdateProps'];
}) {
  // Legacy arrow prop migrates on first read so the selects show reality.
  const legacyOn = propKey === 'lineStart'
    ? props.arrow === 'start' || props.arrow === 'both'
    : props.arrow === 'end' || props.arrow === 'both';
  const cur = props[propKey] ?? (legacyOn ? { type: 'triangle' as LineEndType } : { type: 'none' as LineEndType });
  const set = (patch: Partial<{ type: LineEndType; size: LineEndSize }>) =>
    onUpdateProps((p: ShapeProps) => {
      // First touch materializes the legacy arrow prop into explicit ends,
      // so editing one end never loses the other.
      if (p.arrow && p.arrow !== 'none') {
        if ((p.arrow === 'start' || p.arrow === 'both') && !p.lineStart) p.lineStart = { type: 'triangle' };
        if ((p.arrow === 'end' || p.arrow === 'both') && !p.lineEnd) p.lineEnd = { type: 'triangle' };
      }
      p.arrow = undefined;
      const next = { type: cur.type, size: cur.size ?? 'md', ...patch };
      p[propKey] = next.type === 'none' ? undefined : next;
    });
  return (
    <Row>
      <Field label={label}>
        <SelectInput value={cur.type} options={END_TYPES} onChange={(v) => set({ type: v as LineEndType })} />
      </Field>
      <Field label="Size">
        <SelectInput value={cur.size ?? 'md'} options={END_SIZES} onChange={(v) => set({ size: v as LineEndSize })} />
      </Field>
    </Row>
  );
}

export function ShapeProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as ShapeProps;
  const openPen = useUiStore((s) => s.openPenEditor);
  if (props.isLine) {
    return (
      <>
        <Field label="Line color">
          <ColorInput value={props.borderColor} onChange={(v) => onUpdateProps((p: ShapeProps) => { p.borderColor = v; })} />
        </Field>
        <Field label="Line width">
          <NumberInput value={props.borderWidth} min={1} max={24} onChange={(v) => onUpdateProps((p: ShapeProps) => { p.borderWidth = Math.max(1, v); })} />
        </Field>
        <LineEndControls label="Start arrow" propKey="lineStart" props={props} onUpdateProps={onUpdateProps} />
        <LineEndControls label="End arrow" propKey="lineEnd" props={props} onUpdateProps={onUpdateProps} />
        <p className="hint">Arrowheads scale with the line width, like PowerPoint. Resize the block to angle the line.</p>
      </>
    );
  }
  return (
    <>
      <ButtonField label={`Shape: ${props.nodes?.length || props.points ? 'Custom (pen)' : SHAPE_LABELS[props.kind]}`}>
        <ShapePicker
          value={props.nodes?.length || props.points ? null : props.kind}
          onPick={(kind) => onUpdateProps((p: ShapeProps) => { p.kind = kind; p.points = undefined; p.nodes = undefined; p.smooth = undefined; })}
        />
      </ButtonField>
      <button className="btn" onClick={() => openPen(block.id, 'shape')} title="Draw or edit a custom shape with the pen tool">
        {props.nodes?.length || props.points ? 'Edit custom shape (pen)' : 'Draw custom shape (pen)'}
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
