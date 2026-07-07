import type { Block, ShadowSpec } from '../schema/types';
import { SHADOW_PRESETS, effectiveShadow } from '../shared/shadow';
import { ColorInput, Field, NumberInput, Row, SelectInput } from './fields';

// PowerPoint-style shadow controls, shared by every visual block type.
// A preset is just a starting point - every value stays editable after.

export function ShadowSection({ block, onUpdate }: {
  block: Block;
  onUpdate: (fn: (b: Block) => void) => void;
}) {
  const shadow = effectiveShadow(block);
  const write = (patch: Partial<ShadowSpec>) =>
    onUpdate((b) => {
      const cur = effectiveShadow(b) ?? SHADOW_PRESETS[0].spec;
      b.shadow = { ...cur, ...patch };
      // Materializing onto the block retires the legacy boolean.
      (b.props as { shadow?: boolean }).shadow = undefined;
    });

  return (
    <>
      <Field label="Shadow">
        <SelectInput
          value={shadow ? (shadow.inner ? 'inner' : 'outer') : 'none'}
          options={[
            { value: 'none', label: 'None' },
            { value: 'outer', label: 'Outer' },
            { value: 'inner', label: 'Inner' }
          ]}
          onChange={(v) =>
            onUpdate((b) => {
              (b.props as { shadow?: boolean }).shadow = undefined;
              if (v === 'none') { b.shadow = undefined; return; }
              const cur = effectiveShadow(b) ?? SHADOW_PRESETS[0].spec;
              b.shadow = { ...cur, inner: v === 'inner' || undefined };
            })
          }
        />
      </Field>
      {shadow && (
        <>
          <Field label="Preset">
            <SelectInput
              value=""
              options={[
                { value: '', label: 'Choose a preset...' },
                ...SHADOW_PRESETS.map((p, i) => ({ value: String(i), label: p.label }))
              ]}
              onChange={(v) => {
                if (v === '') return;
                onUpdate((b) => { b.shadow = { ...SHADOW_PRESETS[Number(v)].spec }; });
              }}
            />
          </Field>
          <Row>
            <Field label="Color">
              <ColorInput value={shadow.color} onChange={(v) => write({ color: v })} />
            </Field>
            <Field label="Opacity %">
              <NumberInput
                value={Math.round(shadow.opacity * 100)}
                min={0}
                max={100}
                onChange={(v) => write({ opacity: Math.max(0, Math.min(100, v)) / 100 })}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Blur (px)">
              <NumberInput value={shadow.blur} min={0} onChange={(v) => write({ blur: Math.max(0, v) })} />
            </Field>
            <Field label="Distance (px)">
              <NumberInput value={shadow.distance} min={0} onChange={(v) => write({ distance: Math.max(0, v) })} />
            </Field>
          </Row>
          <Field label="Angle (deg, 90 = below)">
            <NumberInput value={shadow.angle} step={15} onChange={(v) => write({ angle: ((v % 360) + 360) % 360 })} />
          </Field>
        </>
      )}
    </>
  );
}
