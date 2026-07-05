import { useRef } from 'react';
import { useCurrentSlide, useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { timelineDuration } from '../engine/timeline';
import { blockDisplayName } from '../shared/blockName';
import type { Block } from '../schema/types';
import { useWaveform } from '../shared/useWaveform';

// Storyline-style timeline strip. Rows are ordered by stacking (top of the
// z-order at the top of the list), and each bar shows draggable
// animation-in / animation-out ramps at its ends. Same gesture discipline
// as the canvas: record() once on pointer-down, silent mutations while
// dragging, so a whole drag is one undo step. Snap is toggleable.

const ROW_H = 34;
const SNAP = 0.1;

type GestureMode = 'move' | 'trim' | 'trimStart' | 'animIn' | 'animOut';

export function TimelinePanel({ maxHeight, onCollapse }: { maxHeight?: number; onCollapse?: () => void }) {
  const slide = useCurrentSlide();
  const select = useProjectStore((s) => s.select);
  const selection = useProjectStore((s) => s.selection);
  const record = useProjectStore((s) => s.record);
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const moveBlockZ = useProjectStore((s) => s.moveBlockZ);
  const mutate = useProjectStore((s) => s.mutate);
  const snap = useUiStore((s) => s.timelineSnap);
  const setSnap = useUiStore((s) => s.setTimelineSnap);
  const trackRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    blockId: string; mode: GestureMode;
    startX: number; origStart: number; origEnd: number | undefined;
    origIn: number; origOut: number;
  } | null>(null);

  if (!slide.timeline) {
    return (
      <div className="timeline-panel empty" style={maxHeight ? { maxHeight, height: maxHeight } : undefined}>
        <div className="timeline-head">
          <span className="timeline-title">Timeline</span>
          <button
            className="btn"
            onClick={() =>
              mutate((p) => {
                const s = p.slides.find((sl) => sl.id === slide.id);
                if (s) s.timeline = { duration: 10, autoAdvance: false };
              })
            }
          >
            Add a timeline
          </button>
          <span className="hint">Gives this slide a clock, animation timing, and narration.</span>
        </div>
      </div>
    );
  }

  const blocks = slide.layers.flatMap((l) => l.blocks);
  const duration = timelineDuration(slide.timeline, blocks);
  const driven = Boolean(slide.timeline.narrationSrc || slide.timeline.tts);

  const pxPerSec = () => (trackRef.current?.clientWidth ?? 600) / duration;
  const q = (v: number) => (snap ? Math.round(v / SNAP) * SNAP : Math.round(v * 100) / 100);

  const onDown = (e: React.PointerEvent, blockId: string, mode: GestureMode) => {
    e.stopPropagation();
    const b = blocks.find((x) => x.id === blockId);
    if (!b) return;
    select({ blockId, blockIds: [] });
    record();
    if (!b.timing) {
      updateBlock(blockId, (blk) => { blk.timing = { start: 0, end: duration }; }, false);
    }
    const t = b.timing;
    gesture.current = {
      blockId, mode,
      startX: e.clientX,
      origStart: t?.start ?? 0,
      origEnd: t?.end ?? (t ? undefined : duration),
      origIn: t?.animIn?.duration ?? 0,
      origOut: t?.animOut?.duration ?? 0
    };
    const onMove = (ev: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const dSec = (ev.clientX - g.startX) / pxPerSec();
      updateBlock(g.blockId, (blk) => {
        if (!blk.timing) return;
        const end = blk.timing.end ?? duration;
        const span = end - blk.timing.start;
        if (g.mode === 'move') {
          const len = (g.origEnd ?? duration) - g.origStart;
          const ns = Math.max(0, Math.min(q(g.origStart + dSec), duration - 0.2));
          blk.timing.start = ns;
          if (g.origEnd !== undefined) blk.timing.end = Math.min(q(ns + len), duration);
        } else if (g.mode === 'trim') {
          const base = g.origEnd ?? duration;
          blk.timing.end = Math.max(blk.timing.start + 0.2, Math.min(q(base + dSec), duration));
        } else if (g.mode === 'trimStart') {
          // Move the start edge only; the end stays put (mirror of 'trim').
          const endFixed = g.origEnd ?? duration;
          blk.timing.start = Math.max(0, Math.min(q(g.origStart + dSec), endFixed - 0.2));
          if (g.origEnd !== undefined) blk.timing.end = endFixed;
        } else if (g.mode === 'animIn') {
          const dur = Math.max(0, Math.min(q(g.origIn + dSec), span));
          blk.timing.animIn = dur > 0.01
            ? { type: blk.timing.animIn && blk.timing.animIn.type !== 'none' ? blk.timing.animIn.type : 'fade', duration: dur, ease: blk.timing.animIn?.ease ?? 'power2.out' }
            : undefined;
        } else if (g.mode === 'animOut') {
          const dur = Math.max(0, Math.min(q(g.origOut - dSec), span));
          blk.timing.animOut = dur > 0.01
            ? { type: blk.timing.animOut && blk.timing.animOut.type !== 'none' ? blk.timing.animOut.type : 'fade', duration: dur, ease: blk.timing.animOut?.ease ?? 'power2.in' }
            : undefined;
        }
      }, false);
    };
    const onUp = () => {
      gesture.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const ticks: number[] = [];
  const step = duration > 30 ? 5 : duration > 12 ? 2 : 1;
  for (let s = 0; s <= duration; s += step) ticks.push(s);

  const pct = (sec: number) => `${(sec / duration) * 100}%`;

  const renderBar = (b: Block, layerBlocks: Block[]) => {
    const start = b.timing?.start ?? 0;
    const end = b.timing?.end ?? duration;
    const selected = selection.blockId === b.id;
    const untimed = !b.timing;
    const span = Math.max(0.2, end - start);
    const animIn = b.timing?.animIn?.duration ?? 0;
    const animOut = b.timing?.animOut?.duration ?? 0;
    const idx = layerBlocks.indexOf(b);
    return (
      <div key={b.id} className="timeline-row" style={{ height: ROW_H }}>
        <div className="timeline-row-controls">
          <button className="tl-z" title="Bring forward" disabled={idx >= layerBlocks.length - 1} onClick={() => moveBlockZ(b.id, 'forward')}>{'\u25B2'}</button>
          <button className="tl-z" title="Send backward" disabled={idx <= 0} onClick={() => moveBlockZ(b.id, 'backward')}>{'\u25BC'}</button>
        </div>
        <div className="timeline-lane">
          <div
            className={`timeline-bar ${selected ? 'selected' : ''} ${untimed ? 'untimed' : ''}`}
            style={{ left: pct(start), width: pct(span) }}
            onPointerDown={(e) => onDown(e, b.id, 'move')}
            title={untimed ? 'Whole slide - drag to add timing' : `${start.toFixed(1)}s - ${end.toFixed(1)}s`}
          >
            {!untimed && animIn > 0 && <div className="tl-ramp tl-ramp-in" style={{ width: `${(animIn / span) * 100}%` }} />}
            {!untimed && animOut > 0 && <div className="tl-ramp tl-ramp-out" style={{ width: `${(animOut / span) * 100}%` }} />}
            {b.type === 'audio' && <BarWaveform src={(b.props as { src?: string }).src} />}
            <span className="timeline-bar-label">{blockDisplayName(b)}</span>
            {/* Anim handles live on a thin strip along the TOP edge only, as
                small diamonds, so the whole bar body stays grabbable for
                move/trim even when a ramp is zero-width at the start. */}
            {!untimed && (
              <div className="tl-ramp-strip" onPointerDown={(e) => e.stopPropagation()}>
                <span className="tl-ramp-handle in" style={{ left: `${(animIn / span) * 100}%` }} onPointerDown={(e) => onDown(e, b.id, 'animIn')} title="Drag to set animate-in length" />
                <span className="tl-ramp-handle out" style={{ right: `${(animOut / span) * 100}%` }} onPointerDown={(e) => onDown(e, b.id, 'animOut')} title="Drag to set animate-out length" />
              </div>
            )}
            <span className="timeline-bar-handle start" onPointerDown={(e) => onDown(e, b.id, 'trimStart')} title="Drag to change the start (trims, doesn't move)" />
            <span className="timeline-bar-handle" onPointerDown={(e) => onDown(e, b.id, 'trim')} title="Drag to trim the end" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="timeline-panel" style={maxHeight ? { maxHeight, height: maxHeight } : undefined}>
      <div className="timeline-head">
        <span className="timeline-title">Timeline</span>
        {onCollapse && <button className="btn btn-ghost btn-icon" onClick={onCollapse} title="Hide the timeline">{'\u2013'}</button>}
        <label className="timeline-length" title="How many seconds this slide's timeline runs">
          Length (s)
          <input
            className="input"
            type="number"
            min={1}
            step={0.5}
            value={slide.timeline.duration}
            disabled={driven}
            onChange={(e) =>
              mutate((p) => {
                const s = p.slides.find((sl) => sl.id === slide.id);
                if (s?.timeline) s.timeline.duration = Math.max(1, Number(e.target.value) || 1);
              })
            }
          />
          s
        </label>
        <label className="tl-snap">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          snap
        </label>
        <span className="hint">
          {driven ? 'Length is set by the narration on this slide.' : 'Drag bars to move; ends to trim; the ticks set animate-in/out.'}
        </span>
      </div>
      <div className="timeline-track" ref={trackRef}>
        {/* When content extends past the set length, the timeline auto-grows
            to fit it. Mark the author-set length and shade the region beyond
            it so it's clear the slide runs longer than the number they set. */}
        {duration > slide.timeline.duration + 0.01 && (
          <>
            <div className="timeline-overflow" style={{ left: pct(slide.timeline.duration) }} />
            <div className="timeline-setmark" style={{ left: pct(slide.timeline.duration) }} title={`Set length: ${slide.timeline.duration}s (content runs to ${duration.toFixed(1)}s)`}>
              <span className="timeline-setmark-label">set {slide.timeline.duration}s</span>
            </div>
          </>
        )}
        <div className="timeline-ruler">
          {ticks.map((s) => (
            <span key={s} className="timeline-tick" style={{ left: pct(s) }}>{s}s</span>
          ))}
        </div>
        {slide.layers.map((layer, li) => {
          const ordered = [...layer.blocks].reverse();
          return (
            <div key={layer.id} className="timeline-layer-group">
              <div className="timeline-layer-name">{layer.name}{li === 0 ? ' (base)' : ''}</div>
              {ordered.map((b) => renderBar(b, layer.blocks))}
              {layer.blocks.length === 0 && <p className="empty-note">empty layer</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A faint waveform drawn across an audio bar so timing to the sound is easy.
function BarWaveform({ src }: { src?: string }) {
  const peaks = useWaveform(src, 60);
  if (!peaks) return null;
  return (
    <svg className="tl-wave" viewBox="0 0 100 20" preserveAspectRatio="none">
      {peaks.map((h, i) => {
        const x = (i / peaks.length) * 100;
        const barH = Math.max(1, h * 18);
        return <rect key={i} x={x} y={(20 - barH) / 2} width={100 / peaks.length * 0.7} height={barH} />;
      })}
    </svg>
  );
}
