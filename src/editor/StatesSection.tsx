import type { Block, StateStyle, StyledState } from '../schema/types';
import { ColorInput, Field, NumberInput, Row, SelectInput } from './fields';

// Per-state visual overrides (Storyline model). Defining a state also
// switches behavior on in the runtime: 'selected' toggles on click,
// 'visited' marks after first click, hover/down follow the pointer,
// 'disabled' is set by triggers.

const STATES: { key: StyledState; label: string; blurb: string }[] = [
  { key: 'hover', label: 'Hover', blurb: 'pointer over the block' },
  { key: 'down', label: 'Down', blurb: 'pressed' },
  { key: 'selected', label: 'Selected', blurb: 'click toggles it' },
  { key: 'visited', label: 'Visited', blurb: 'after the first click' },
  { key: 'disabled', label: 'Disabled', blurb: 'set by a trigger' }
];

const EMPHASIS_OPTIONS = [
  { value: 'none', label: 'None' }, { value: 'pulse', label: 'Pulse' },
  { value: 'heartbeat', label: 'Heartbeat' }, { value: 'bounce', label: 'Bounce' },
  { value: 'float', label: 'Float' }, { value: 'wobble', label: 'Wobble' },
  { value: 'tada', label: 'Tada' }, { value: 'glow', label: 'Glow' }, { value: 'shake', label: 'Shake' }
];

// --- small colour helpers so presets can derive from the block's own fill ---
const ACCENT = '#3ddc97';
function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (rgb: [number, number, number]) =>
  '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
// amt > 0 mixes toward white (lighten); amt < 0 toward black (darken).
function shade(hex: string, amt: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const t = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  return toHex(rgb.map((v) => v + (t - v) * k) as [number, number, number]);
}

// The block's current base fill, if it has one, else the theme accent - the
// anchor presets lighten/darken from.
function baseFillOf(block: Block): string {
  const f = (block.props as { fill?: string }).fill;
  return (f && parseHex(f)) ? f : ACCENT;
}

// Sensible starting style per state, derived from the block's own colour so
// "Hover" really is a lighter version of THIS block, not a fixed green.
function presetFor(state: StyledState, base: string): StateStyle {
  switch (state) {
    case 'hover': return { fill: shade(base, 0.16) };
    case 'down': return { fill: shade(base, -0.14) };
    case 'selected': return { fill: shade(base, 0.06), borderColor: ACCENT };
    case 'visited': return { fill: shade(base, -0.05), opacity: 0.9 };
    case 'disabled': return { fill: base, opacity: 0.45 };
    default: return { fill: shade(base, 0.16) };
  }
}

export function StatesSection({ block, onUpdate }: {
  block: Block;
  onUpdate: (fn: (b: Block) => void) => void;
}) {
  const styles = block.stateStyles ?? {};
  const base = baseFillOf(block);
  return (
    <div className="states-section">
      {STATES.map(({ key, label, blurb }) => {
        const st = styles[key];
        return (
          <div key={key} className="state-row">
            <label className="check-item state-toggle">
              <input
                type="checkbox"
                checked={Boolean(st)}
                onChange={(e) =>
                  onUpdate((b) => {
                    b.stateStyles = b.stateStyles ?? {};
                    // Enabling a state seeds a smart default derived from the
                    // block's own fill (lighter for hover, darker for down, ...)
                    // so it looks right immediately and is still fully editable.
                    if (e.target.checked) b.stateStyles[key] = presetFor(key, base);
                    else delete b.stateStyles[key];
                  })
                }
              />
              <strong>{label}</strong>
              <span className="hint-inline">{blurb}</span>
            </label>
            {st && (
              <>
                <Row>
                  <Field label="Fill">
                    <ColorInput
                      value={st.fill ?? ''}
                      onChange={(v) => onUpdate((b) => { b.stateStyles![key] = { ...st, fill: v || undefined }; })}
                    />
                  </Field>
                  <Field label="Border">
                    <ColorInput
                      value={st.borderColor ?? ''}
                      onChange={(v) => onUpdate((b) => { b.stateStyles![key] = { ...st, borderColor: v || undefined }; })}
                    />
                  </Field>
                </Row>
                <Row>
                  <Field label="Text">
                    <ColorInput
                      value={st.textColor ?? ''}
                      onChange={(v) => onUpdate((b) => { b.stateStyles![key] = { ...st, textColor: v || undefined }; })}
                    />
                  </Field>
                  <Field label="Opacity">
                    <NumberInput
                      value={st.opacity ?? 1}
                      step={0.1}
                      onChange={(v) => onUpdate((b) => { b.stateStyles![key] = { ...st, opacity: Math.min(1, Math.max(0, v)) }; })}
                    />
                  </Field>
                </Row>
                <Field label="Emphasis (loops while active)">
                  <SelectInput
                    value={st.emphasis ?? 'none'}
                    options={EMPHASIS_OPTIONS}
                    onChange={(v) => onUpdate((b) => { b.stateStyles![key] = { ...st, emphasis: v === 'none' ? undefined : (v as StateStyle['emphasis']) }; })}
                  />
                </Field>
              </>
            )}
          </div>
        );
      })}
      <p className="hint">
        Enabling a state seeds a colour from this block's fill — tweak it, or add
        an emphasis (e.g. a button that pulses on hover). Interactive states also
        make the block keyboard-accessible: Tab focuses it, Enter/Space clicks it.
      </p>
    </div>
  );
}
