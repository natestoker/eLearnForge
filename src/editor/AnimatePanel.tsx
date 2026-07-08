import { useRef } from 'react';
import { selectedIds, useCurrentSlide, useProjectStore, useSelectedBlock } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { TimingSection } from './TimingSection';
import { CheckboxInput, Field, NumberInput, Row, SelectInput } from './fields';
import { blockDisplayName } from '../shared/blockName';
import type { AnimType, Block } from '../schema/types';

// Sweep the editor playhead across a time window so the effect plays on the
// canvas - entrance effects and motion paths are invisible on the static
// stage otherwise. `windowOf` returns [start, duration] for the block.
function useScrubPreview(windowOf: (b: Block) => [number, number]) {
  const setScrubT = useUiStore((s) => s.setScrubT);
  const raf = useRef<number | null>(null);
  return (block: Block) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const [start, dur0] = windowOf(block);
    const dur = Math.max(dur0, 0.4);
    const t0 = performance.now();
    const pad = 0.4;
    const tick = () => {
      const el = (performance.now() - t0) / 1000;
      if (el >= dur + pad) { setScrubT(null); raf.current = null; return; }
      setScrubT(Math.round((start + Math.min(el, dur)) * 100) / 100);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
}
const useAnimationPreview = () => useScrubPreview((b) => [b.timing?.start ?? 0, b.timing?.animIn?.duration ?? 0.6]);
const useMotionPreview = () => useScrubPreview((b) => [b.motion?.start ?? 0, b.motion?.duration ?? 2]);

const EMPHASES = [
  { value: 'none', label: 'None' }, { value: 'pulse', label: 'Pulse' },
  { value: 'heartbeat', label: 'Heartbeat' }, { value: 'bounce', label: 'Bounce' },
  { value: 'float', label: 'Float' }, { value: 'wobble', label: 'Wobble' },
  { value: 'tada', label: 'Tada' }, { value: 'glow', label: 'Glow' }, { value: 'shake', label: 'Shake' }
];
const ENTRANCES: { value: AnimType | 'none'; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'fade', label: 'Fade' }, { value: 'slide', label: 'Slide' },
  { value: 'rise', label: 'Rise' }, { value: 'wipe', label: 'Wipe' }, { value: 'zoom', label: 'Zoom in' },
  { value: 'grow', label: 'Grow' }, { value: 'flip', label: 'Flip' }, { value: 'bounceIn', label: 'Bounce in' },
  { value: 'spin', label: 'Spin in' }, { value: 'swivel', label: 'Swivel' }, { value: 'whipIn', label: 'Whip in' }
];

// Dedicated animation tab: entrance/exit timing plus a looping emphasis,
// available for every block type (shapes, images, buttons, text, all of
// them) - not just text.
export function AnimatePanel() {
  const slide = useCurrentSlide();
  const block = useSelectedBlock();
  const selection = useProjectStore((s) => s.selection);
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const mutate = useProjectStore((s) => s.mutate);
  const previewAnim = useAnimationPreview();
  const previewMotion = useMotionPreview();

  // 2+ selected: apply one emphasis / entrance to the whole selection.
  const ids = selectedIds(selection);
  if (ids.length >= 2) {
    const applyEmphasis = (v: string) =>
      ids.forEach((id, i) => updateBlock(id, (b) => { b.emphasis = v === 'none' ? undefined : (v as 'pulse'); }, i === 0));
    const ensureTimeline = () => {
      if (!slide.timeline) mutate((p) => { const s = p.slides.find((sl) => sl.id === slide.id); if (s) s.timeline = { duration: 10, autoAdvance: false }; });
    };
    const applyAnim = (which: 'animIn' | 'animOut', v: string) => {
      ensureTimeline();
      ids.forEach((id, i) => updateBlock(id, (b) => {
        if (!b.timing) b.timing = { start: 0 };
        // Exit animations need an end time to run against; default to the
        // slide duration if the block doesn't already have one.
        if (which === 'animOut' && v !== 'none' && b.timing.end === undefined) {
          b.timing.end = slide.timeline?.duration ?? 10;
        }
        b.timing[which] = v === 'none' ? undefined
          : { type: v as AnimType, duration: 0.5, ease: which === 'animOut' ? 'power2.in' : (v === 'rise' ? 'power3.out' : 'power2.out') };
      }, i === 0));
    };
    return (
      <div className="panel-body">
        <h3 className="panel-title">Animate — {ids.length} blocks</h3>
        <p className="hint">Applies to every selected block.</p>
        <Field label="Entrance (all)">
          <SelectInput value="" options={[{ value: '', label: 'Choose…' }, ...ENTRANCES]} onChange={(v) => applyAnim('animIn', v)} />
        </Field>
        <Field label="Exit (all)">
          <SelectInput value="" options={[{ value: '', label: 'Choose…' }, ...ENTRANCES]} onChange={(v) => applyAnim('animOut', v)} />
        </Field>
        <Field label="Emphasis (all)">
          <SelectInput value="" options={[{ value: '', label: 'Choose…' }, ...EMPHASES]} onChange={applyEmphasis} />
        </Field>
        <p className="hint">Select a single block to fine-tune its timing and easing.</p>
      </div>
    );
  }

  if (!block) {
    return (
      <div className="panel-body">
        <p className="hint">
          Select a block on the canvas (or its bar in the timeline strip) to
          set its entrance/exit animation and emphasis.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-body">
      <h3 className="panel-title">Animate - {blockDisplayName(block)}</h3>

      <h4 className="panel-subtitle">Emphasis (loops in the player)</h4>
      <Field label="Emphasis">
        <SelectInput
          value={block.emphasis ?? 'none'}
          options={[
            { value: 'none', label: 'None' },
            { value: 'pulse', label: 'Pulse' },
            { value: 'heartbeat', label: 'Heartbeat' },
            { value: 'bounce', label: 'Bounce' },
            { value: 'float', label: 'Float' },
            { value: 'wobble', label: 'Wobble' },
            { value: 'tada', label: 'Tada' },
            { value: 'glow', label: 'Glow' },
            { value: 'shake', label: 'Shake' }
          ]}
          onChange={(v) => updateBlock(block.id, (b) => { b.emphasis = v === 'none' ? undefined : (v as 'pulse'); })}
        />
      </Field>

      <div className="divider" />
      <h4 className="panel-subtitle">Entrance / exit (on the timeline)</h4>
      {!slide.timeline ? (
        <>
          <p className="hint">Entrance/exit animations run on the slide timeline.</p>
          <button
            className="btn"
            onClick={() =>
              mutate((p) => {
                const s = p.slides.find((sl) => sl.id === slide.id);
                if (s) s.timeline = { duration: 10, autoAdvance: false };
              })
            }
          >
            Add a timeline to this slide
          </button>
        </>
      ) : (
        <>
          <TimingSection
            block={block}
            onUpdate={(fn, history = true) => updateBlock(block.id, (b) => fn(b), history)}
          />
          {(block.timing?.animIn || block.timing?.animInStack?.length) && (
            <button
              className="btn btn-accent"
              style={{ marginTop: 8 }}
              title="Play this entrance on the canvas so you can see the direction and options"
              onClick={() => previewAnim(block)}
            >
              ▶ Preview animation
            </button>
          )}
          <div className="divider" />
          <MotionSection block={block} updateBlock={updateBlock} onPreview={previewMotion} />
        </>
      )}
    </div>
  );
}

function MotionSection({ block, updateBlock, onPreview }: {
  block: Block;
  updateBlock: (id: string, fn: (b: Block) => void, history?: boolean) => void;
  onPreview: (block: Block) => void;
}) {
  const m = block.motion;
  const set = (fn: (mm: NonNullable<Block['motion']>) => void) =>
    updateBlock(block.id, (b) => { if (b.motion) fn(b.motion); });
  return (
    <>
      <h4 className="panel-subtitle">Motion path</h4>
      <Field label="Path">
        <SelectInput
          value={m?.preset ?? 'none'}
          options={[
            { value: 'none', label: 'None' },
            { value: 'line', label: 'Line' },
            { value: 'arc', label: 'Arc' },
            { value: 'circle', label: 'Circle' }
          ]}
          onChange={(v) => updateBlock(block.id, (b) => {
            if (v === 'none') { b.motion = undefined; return; }
            const prev = b.motion;
            b.motion = {
              preset: v as 'line' | 'arc' | 'circle',
              vector: prev?.vector ?? { x: 200, y: 0 },
              start: prev?.start ?? 0,
              duration: prev?.duration ?? 2,
              ease: prev?.ease ?? 'power1.inOut',
              loop: v === 'circle' ? (prev?.loop ?? true) : prev?.loop
            };
          })}
        />
      </Field>
      {m && (
        <>
          <p className="hint">Drag the orange handle on the canvas to shape the path.</p>
          <Row>
            <Field label="Start (s)"><NumberInput value={m.start} step={0.1} onChange={(v) => set((mm) => { mm.start = Math.max(0, v); })} /></Field>
            <Field label="Duration (s)"><NumberInput value={m.duration} step={0.1} onChange={(v) => set((mm) => { mm.duration = Math.max(0.1, v); })} /></Field>
          </Row>
          <Field label="Ease">
            <SelectInput
              value={m.ease}
              options={['none', 'power1.inOut', 'power2.out', 'power2.inOut', 'back.out(1.7)', 'elastic.out(1, 0.5)'].map((e) => ({ value: e, label: e }))}
              onChange={(v) => set((mm) => { mm.ease = v; })}
            />
          </Field>
          <CheckboxInput label="Loop" checked={m.loop ?? false} onChange={(v) => set((mm) => { mm.loop = v || undefined; })} />
          <button className="btn btn-accent" style={{ marginTop: 8 }} onClick={() => onPreview(block)}>▶ Preview motion</button>
        </>
      )}
    </>
  );
}
