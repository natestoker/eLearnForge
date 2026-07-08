import type { Block, ReflectionSpec } from '../schema/types';
import { REFLECTION_PRESETS } from '../shared/shadow';
import { CheckboxInput, Field, NumberInput, RangeInput, Row, SelectInput } from './fields';

// PowerPoint-style reflection controls, shared by every visual block type.
const DEFAULT_REFLECTION: ReflectionSpec = { opacity: 0.5, size: 0.6, distance: 4, direction: 'below' };

export function ReflectionSection({ block, onUpdate }: {
  block: Block;
  onUpdate: (fn: (b: Block) => void) => void;
}) {
  const r = block.reflection;
  const write = (patch: Partial<ReflectionSpec>) =>
    onUpdate((b) => { b.reflection = { ...(b.reflection ?? DEFAULT_REFLECTION), ...patch }; });

  return (
    <>
      <CheckboxInput
        label="Reflection (mirrored copy)"
        checked={Boolean(r)}
        onChange={(v) => onUpdate((b) => { b.reflection = v ? { ...DEFAULT_REFLECTION } : undefined; })}
      />
      {r && (
        <>
          <Field label="Preset">
            <div className="field-row">
              {REFLECTION_PRESETS.map((p) => (
                <button key={p.label} className="btn" onClick={() => onUpdate((b) => { b.reflection = { ...p.spec, direction: r.direction ?? 'below' }; })}>{p.label}</button>
              ))}
            </div>
          </Field>
          <Field label="Mirror side">
            <SelectInput
              value={r.direction ?? 'below'}
              options={[
                { value: 'below', label: 'Below (classic)' },
                { value: 'above', label: 'Above' },
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' }
              ]}
              onChange={(v) => write({ direction: v as ReflectionSpec['direction'] })}
            />
          </Field>
          <Field label="Strength">
            <RangeInput value={Math.round(r.opacity * 100)} min={0} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => write({ opacity: v / 100 })} />
          </Field>
          <Field label="Size (how far it fades)">
            <RangeInput value={Math.round(r.size * 100)} min={10} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => write({ size: v / 100 })} />
          </Field>
          <Row>
            <Field label="Gap (px)">
              <NumberInput value={r.distance} min={0} onChange={(v) => write({ distance: Math.max(0, v) })} />
            </Field>
          </Row>
          <p className="hint">Renders in Chromium/WebKit browsers (Chrome, Edge, Safari).</p>
        </>
      )}
    </>
  );
}
