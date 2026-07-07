import { useRef } from 'react';
import { selectedIds, useCurrentSlide, useProjectStore, useSelectedBlock } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { TimingSection } from './TimingSection';
import { Field, SelectInput } from './fields';
import { blockDisplayName } from '../shared/blockName';
import type { AnimType, Block } from '../schema/types';

// Sweep the editor playhead across a block's entrance window so its
// animation (and its direction/distance options) plays on the canvas -
// otherwise entrance effects are invisible on the static stage.
function useAnimationPreview() {
  const setScrubT = useUiStore((s) => s.setScrubT);
  const raf = useRef<number | null>(null);
  return (block: Block) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const start = block.timing?.start ?? 0;
    const dur = Math.max(block.timing?.animIn?.duration ?? 0.6, 0.4);
    const t0 = performance.now();
    const pad = 0.4; // linger briefly at rest so the end state is visible
    const tick = () => {
      const el = (performance.now() - t0) / 1000;
      if (el >= dur + pad) { setScrubT(null); raf.current = null; return; }
      setScrubT(Math.round((start + Math.min(el, dur)) * 100) / 100);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
}

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
          {block.timing?.animIn && (
            <button
              className="btn btn-accent"
              style={{ marginTop: 8 }}
              title="Play this entrance on the canvas so you can see the direction and options"
              onClick={() => previewAnim(block)}
            >
              ▶ Preview animation
            </button>
          )}
        </>
      )}
    </div>
  );
}
