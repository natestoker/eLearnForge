import type { AnimDirection, AnimSpec, AnimType, Block, BlockTiming } from '../schema/types';
import type { UpdateProps } from '../blocks/blockApi';
import { normalizeAnimSpec, defaultDirection } from '../engine/timeline';
import { Field, NumberInput, Row, SelectInput } from './fields';

// Shared timing editor shown for any selected block when the slide has a
// timeline. Writes block.timing through the same update path as props.

// One entry per effect; direction and distance are options below, not
// separate list entries (Wipe + Direction, not Wipe Up / Wipe Down / ...).
const ANIMS: { value: AnimType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'rise', label: 'Rise' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'zoom', label: 'Zoom in' },
  { value: 'zoomOut', label: 'Zoom out' },
  { value: 'blur', label: 'Blur' },
  { value: 'spin', label: 'Spin in' },
  { value: 'flip', label: 'Flip' },
  { value: 'bounceIn', label: 'Bounce in' },
  { value: 'popRotate', label: 'Pop + rotate' },
  { value: 'grow', label: 'Grow' },
  { value: 'stretch', label: 'Stretch (horizontal)' },
  { value: 'collapse', label: 'Unfold (vertical)' },
  { value: 'drop', label: 'Drop in' },
  { value: 'swivel', label: 'Swivel' },
  { value: 'whipIn', label: 'Whip in' },
  { value: 'flyCorner', label: 'Fly from corner' },
  { value: 'roll', label: 'Roll in' }
];

const DIRECTIONAL: AnimType[] = ['slide', 'rise', 'wipe', 'flip', 'whipIn', 'flyCorner', 'roll'];
const DISTANCED: AnimType[] = ['slide', 'rise', 'drop', 'whipIn', 'blur', 'flyCorner', 'roll'];
const SIDE_DIRECTIONS: { value: AnimDirection; label: string }[] = [
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' }
];
const CORNER_DIRECTIONS: { value: AnimDirection; label: string }[] = [
  { value: 'upLeft', label: 'Top-left' },
  { value: 'upRight', label: 'Top-right' },
  { value: 'downLeft', label: 'Bottom-left' },
  { value: 'downRight', label: 'Bottom-right' }
];
const LR_DIRECTIONS: { value: AnimDirection; label: string }[] = [
  { value: 'left', label: 'From left' },
  { value: 'right', label: 'From right' }
];
// The direction choices depend on the effect: corners fly from corners, roll
// enters from a side, everything else uses the four cardinal directions.
function directionsFor(type: AnimType): { value: AnimDirection; label: string }[] {
  if (type === 'flyCorner') return CORNER_DIRECTIONS;
  if (type === 'roll') return LR_DIRECTIONS;
  return SIDE_DIRECTIONS;
}

const EASES = ['power2.out', 'power2.inOut', 'power3.out', 'power4.out', 'back.out(1.7)', 'elastic.out(1, 0.5)', 'none'];

function defaultAnim(): AnimSpec {
  return { type: 'fade', duration: 0.5, ease: 'power2.out' };
}

function AnimEditor(props: {
  label: string;
  spec: AnimSpec | undefined;
  onChange: (spec: AnimSpec | undefined) => void;
}) {
  // Normalize so legacy per-direction values (slideUp...) display and edit
  // as the consolidated effect + Direction.
  const spec = props.spec ? normalizeAnimSpec(props.spec) : undefined;
  const type = spec?.type ?? 'none';
  return (
    <>
      <Row>
        <Field label={props.label}>
          <SelectInput
            value={type}
            options={ANIMS}
            onChange={(v) => {
              if (v === 'none') props.onChange(undefined);
              else {
                const next: AnimSpec = { ...(spec ?? defaultAnim()), type: v as AnimType };
                // Rise reads best with its slower deceleration.
                if (v === 'rise' && !props.spec) next.ease = 'power3.out';
                if (!DIRECTIONAL.includes(v as AnimType)) next.direction = undefined;
                if (!DISTANCED.includes(v as AnimType)) next.distance = undefined;
                props.onChange(next);
              }
            }}
          />
        </Field>
        <Field label="Seconds">
          <NumberInput
            value={spec?.duration ?? 0.5}
            step={0.1}
            onChange={(v) => spec && props.onChange({ ...spec, duration: Math.max(0.1, v) })}
          />
        </Field>
      </Row>
      {spec && (DIRECTIONAL.includes(type as AnimType) || DISTANCED.includes(type as AnimType)) && (
        <Row>
          {DIRECTIONAL.includes(type as AnimType) && (
            <Field label="Direction">
              <SelectInput
                value={spec.direction ?? defaultDirection(type as AnimType)}
                options={directionsFor(type as AnimType)}
                onChange={(v) => props.onChange({ ...spec, direction: v as AnimDirection })}
              />
            </Field>
          )}
          {DISTANCED.includes(type as AnimType) && (
            <Field label={type === 'blur' ? 'Blur radius (px)' : 'Distance (px)'}>
              <NumberInput
                value={spec.distance ?? (type === 'rise' ? 160 : type === 'blur' ? 12 : 40)}
                step={type === 'blur' ? 2 : 10}
                onChange={(v) => props.onChange({ ...spec, distance: Math.max(0, v) })}
              />
            </Field>
          )}
        </Row>
      )}
      {spec && (
        <Field label="Ease">
          <SelectInput
            value={spec.ease}
            options={EASES.map((e) => ({ value: e, label: e }))}
            onChange={(v) => props.onChange({ ...spec, ease: v })}
          />
        </Field>
      )}
    </>
  );
}

export function TimingSection({ block, onUpdate }: { block: Block; onUpdate: UpdateProps }) {
  const timing = block.timing;
  const write = (fn: (b: Block) => void) => {
    // UpdateProps mutates props; timing lives on the block itself, so we go
    // through the store's block updater exposed on onUpdate's owner. The
    // PropertyPanel passes an updater bound to the whole block.
    onUpdate((b: Block) => fn(b));
  };

  if (!timing) {
    return (
      <div className="timing-section">
        <button
          className="btn"
          onClick={() => write((b) => { b.timing = { start: 0 }; })}
        >
          Add to timeline
        </button>
        <p className="hint">Without timing, this block is visible for the whole slide.</p>
      </div>
    );
  }

  return (
    <div className="timing-section">
      <Row>
        <Field label="Start (s)">
          <NumberInput
            value={timing.start}
            step={0.1}
            onChange={(v) => write((b) => { b.timing!.start = Math.max(0, v); })}
          />
        </Field>
        <Field label="End (s)">
          <NumberInput
            value={timing.end ?? -1}
            step={0.1}
            onChange={(v) =>
              write((b) => {
                if (v < 0) b.timing!.end = undefined;
                else b.timing!.end = Math.max(b.timing!.start + 0.2, v);
              })
            }
          />
        </Field>
      </Row>
      <p className="hint">End of -1 means the block stays until the timeline ends.</p>
      <AnimEditor
        label="Animate in"
        spec={timing.animIn}
        onChange={(spec) => write((b) => { b.timing!.animIn = spec; })}
      />
      {(timing.animInStack ?? []).map((s, i) => (
        <div key={`in${i}`} className="stack-anim">
          <AnimEditor
            label={`+ Entrance ${i + 2}`}
            spec={s}
            onChange={(spec) => write((b) => {
              const arr = [...(b.timing!.animInStack ?? [])];
              if (!spec) arr.splice(i, 1); else arr[i] = spec;
              b.timing!.animInStack = arr.length ? arr : undefined;
            })}
          />
        </div>
      ))}
      <button
        className="btn btn-ghost tl-add-anim"
        title="Stack another entrance effect that plays together with the one above (e.g. fade + spin)"
        onClick={() => write((b) => { b.timing!.animInStack = [...(b.timing!.animInStack ?? []), defaultAnim()]; })}
      >
        + Stack another entrance
      </button>

      <AnimEditor
        label="Animate out"
        spec={timing.animOut}
        onChange={(spec) => write((b) => { b.timing!.animOut = spec; })}
      />
      {(timing.animOutStack ?? []).map((s, i) => (
        <div key={`out${i}`} className="stack-anim">
          <AnimEditor
            label={`+ Exit ${i + 2}`}
            spec={s}
            onChange={(spec) => write((b) => {
              const arr = [...(b.timing!.animOutStack ?? [])];
              if (!spec) arr.splice(i, 1); else arr[i] = spec;
              b.timing!.animOutStack = arr.length ? arr : undefined;
            })}
          />
        </div>
      ))}
      <button
        className="btn btn-ghost tl-add-anim"
        title="Stack another exit effect that plays together with the one above"
        onClick={() => write((b) => { b.timing!.animOutStack = [...(b.timing!.animOutStack ?? []), { ...defaultAnim(), ease: 'power2.in' }] })}
      >
        + Stack another exit
      </button>

      <button className="btn btn-ghost btn-danger" style={{ marginTop: 8 }} onClick={() => write((b) => { b.timing = undefined; })}>
        Remove from timeline
      </button>
    </div>
  );
}
