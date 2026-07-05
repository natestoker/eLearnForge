import type { Block, StateStyle, StyledState } from '../schema/types';
import { ColorInput, Field, NumberInput, Row } from './fields';

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

export function StatesSection({ block, onUpdate }: {
  block: Block;
  onUpdate: (fn: (b: Block) => void) => void;
}) {
  const styles = block.stateStyles ?? {};
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
                    if (e.target.checked) b.stateStyles[key] = { fill: '#2fa87a' };
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
              </>
            )}
          </div>
        );
      })}
      <p className="hint">
        Interactive states also make the block keyboard-accessible: Tab
        focuses it, Enter/Space clicks it.
      </p>
    </div>
  );
}
