import React, { Fragment, useEffect, useRef, useState } from 'react';
import { selectedIds, useCurrentSlide, useProjectStore, walkBlocks } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { timelineDuration } from '../engine/timeline';
import { blockDisplayName } from '../shared/blockName';
import type { Block, Layer } from '../schema/types';
import { useWaveform } from '../shared/useWaveform';
import { ScrubAudio } from './scrubAudio';
import { uid } from '../schema/factory';

// Storyline-style timeline strip.
// Uses a clean, aligned two-column layout:
// - Left: Locked headers column (Z-ordering, visibility, block name, and expand/collapse).
// - Right: Scrollable lane grid (timing bars, ramps, waveform).
// Both sides render recursively to stay perfectly synchronized.

const ROW_H = 34;
const SNAP = 0.1;

type GestureMode = 'move' | 'trim' | 'trimStart' | 'animIn' | 'animOut';

export function TimelinePanel({ maxHeight, onCollapse }: { maxHeight?: number; onCollapse?: () => void }) {
  const slide = useCurrentSlide();
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const record = useProjectStore((s) => s.record);
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const moveBlockZ = useProjectStore((s) => s.moveBlockZ);
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [timelineZoom, setTimelineZoom] = useState(1);

  const toggleGroup = (e: React.PointerEvent | React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedGroups((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mutate = useProjectStore((s) => s.mutate);
  const snap = useUiStore((s) => s.timelineSnap);
  const setSnap = useUiStore((s) => s.setTimelineSnap);
  const scrubT = useUiStore((s) => s.scrubT);
  const setScrubT = useUiStore((s) => s.setScrubT);
  const trackRef = useRef<HTMLDivElement>(null);

  // The playhead is per-slide-visit state: switching slides clears it.
  useEffect(() => { setScrubT(null); }, [slide.id, setScrubT]);

  // Audio scrubbing: dragging the playhead plays synchronized snippets of
  // narration / audio blocks / attached audio, so animation can be timed
  // to speech by ear. Sources reload when the slide (or its audio) changes.
  const scrubAudioRef = useRef<ScrubAudio | null>(null);
  if (!scrubAudioRef.current) scrubAudioRef.current = new ScrubAudio();
  useEffect(() => () => scrubAudioRef.current?.dispose(), []);

  // Timeline playback: previews animations AND audio right on the canvas
  // (via the scrub playhead), no full Preview needed. rAF drives the clock;
  // ScrubAudio keeps every source in sync.
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<number | null>(null);
  const stopPlay = (at?: number) => {
    if (playRef.current !== null) cancelAnimationFrame(playRef.current);
    playRef.current = null;
    scrubAudioRef.current?.pauseAll();
    setPlaying(false);
    if (at !== undefined) setScrubT(at);
  };
  useEffect(() => { stopPlay(); /* slide switch kills playback */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id]);
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

  // Find all blocks recursively (including grouped blocks)
  const blocks = walkBlocks(slide.layers.flatMap((l) => l.blocks));
  const duration = timelineDuration(slide.timeline, blocks);
  const driven = Boolean(slide.timeline.narrationSrc);
  const selectedRowIds = new Set(selectedIds(selection));
  const cues = slide.timeline.cues ?? [];

  const pxPerSec = () => ((trackRef.current?.clientWidth ?? 600) * timelineZoom) / duration;
  const q = (v: number) => (snap ? Math.round(v / SNAP) * SNAP : Math.round(v * 100) / 100);

  const blockLayer = (blockId: string): Layer | undefined =>
    slide.layers.find((l) => walkBlocks(l.blocks).some((b) => b.id === blockId));
  const rowLocked = (b: Block): boolean => Boolean(b.locked || blockLayer(b.id)?.locked);

  const onDown = (e: React.PointerEvent, blockId: string, mode: GestureMode) => {
    e.stopPropagation();
    const b = blocks.find((x) => x.id === blockId);
    if (!b) return;
    select({ blockId, blockIds: [] });
    if (rowLocked(b)) return; // locked rows select but never retime
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

  // Scrub: press/drag on the ruler places the playhead; the canvas previews
  // every block's presence and animation at that time.
  const scrubFromEvent = (e: { clientX: number }) => {
    const content = trackRef.current?.querySelector('.timeline-grid-scroll-content') as HTMLElement | null;
    if (!content) return;
    const r = content.getBoundingClientRect();
    const t = Math.max(0, Math.min(duration, ((e.clientX - r.left) / r.width) * duration));
    const snapped = Math.round(t * 20) / 20;
    setScrubT(snapped);
    scrubAudioRef.current?.scrub(snapped);
  };
  const startPlay = () => {
    const from = scrubT !== null && scrubT < duration - 0.05 ? scrubT : 0;
    scrubAudioRef.current?.load(slide, duration);
    scrubAudioRef.current?.playFrom(from);
    setPlaying(true);
    const wall = performance.now();
    const tick = () => {
      const t = from + (performance.now() - wall) / 1000;
      if (t >= duration) { stopPlay(duration); return; }
      setScrubT(Math.round(t * 100) / 100);
      scrubAudioRef.current?.syncPlaying(t);
      playRef.current = requestAnimationFrame(tick);
    };
    playRef.current = requestAnimationFrame(tick);
  };

  const onRulerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    stopPlay();
    // (Re)load this slide's audio sources at drag start; the pointer press
    // is the user gesture autoplay policies want.
    scrubAudioRef.current?.load(slide, duration);
    scrubFromEvent(e);
    const onMove = (ev: PointerEvent) => scrubFromEvent(ev);
    const onUp = () => {
      scrubAudioRef.current?.pauseAll();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const addCue = () => {
    const at = scrubT !== null ? scrubT : 0;
    const name = window.prompt('Cue name', `Cue ${cues.length + 1}`);
    if (name === null) return;
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      if (s?.timeline) {
        s.timeline.cues = [...(s.timeline.cues ?? []), { id: uid('cue'), name: name || `Cue ${cues.length + 1}`, time: Math.round(at * 100) / 100 }]
          .sort((a, b) => a.time - b.time);
      }
    });
  };
  const removeCue = (id: string) =>
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      if (s?.timeline?.cues) s.timeline.cues = s.timeline.cues.filter((c) => c.id !== id);
    });

  // Shift/Cmd/Ctrl-click a row to add it to (or remove it from) the timeline
  // selection - the same multi-selection the canvas and property panels use.
  // Returns true if it handled a multi-select (so the caller skips the drag).
  const multiSelectRow = (e: React.PointerEvent | React.MouseEvent, blockId: string): boolean => {
    if (!(e.shiftKey || e.metaKey || e.ctrlKey)) return false;
    e.stopPropagation();
    const sel = useProjectStore.getState().selection;
    const cur = new Set(selectedIds(sel));
    if (cur.has(blockId)) cur.delete(blockId);
    else cur.add(blockId);
    const ids = [...cur];
    if (ids.length === 0) select({ blockId: null, blockIds: [] });
    else select({ blockId: ids[ids.length - 1], blockIds: ids.slice(0, -1) });
    return true;
  };

  // Row drag-reorder: dragging a header row (its grip or name) restacks the
  // block within its sibling list live - z-order updates as you drag, like
  // AE/Premiere. Multi-selected siblings travel together as a chunk.
  const startRowDrag = (e: React.PointerEvent, b: Block, parent: { layerId?: string; groupId?: string }, dispIdx: number, count: number) => {
    if (e.button !== 0) return;
    if (multiSelectRow(e, b.id)) return; // shift/cmd-click = select, not drag
    e.stopPropagation();
    const sel = useProjectStore.getState().selection;
    const ids = selectedIds(sel).includes(b.id) ? selectedIds(sel) : [b.id];
    select({ blockId: b.id, blockIds: ids.filter((id) => id !== b.id) });
    const startY = e.clientY;
    let recorded = false;
    let cur = dispIdx;
    const apply = (target: number) => {
      mutate((p) => {
        const s = p.slides.find((sl) => sl.id === slide.id);
        if (!s) return;
        let arr: Block[] | undefined;
        if (parent.layerId) arr = s.layers.find((l) => l.id === parent.layerId)?.blocks;
        else if (parent.groupId) {
          const g = s.layers.flatMap((l) => walkBlocks(l.blocks)).find((x) => x.id === parent.groupId);
          arr = g ? ((g.props as { blocks: Block[] }).blocks) : undefined;
        }
        if (!arr) return;
        const disp = [...arr].reverse(); // rows list top-most first
        const moving = disp.filter((x) => ids.includes(x.id));
        const rest = disp.filter((x) => !ids.includes(x.id));
        rest.splice(Math.max(0, Math.min(target, rest.length)), 0, ...moving);
        arr.splice(0, arr.length, ...rest.reverse());
      }, false);
    };
    const onMove = (ev: PointerEvent) => {
      const target = Math.max(0, Math.min(count - 1, dispIdx + Math.round((ev.clientY - startY) / ROW_H)));
      if (target === cur) return;
      if (!recorded) { record(); recorded = true; }
      cur = target;
      apply(target);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Render the left-hand column track info recursively
  const renderHeaderRow = (b: Block, layerBlocks: Block[], depth: number, parent: { layerId?: string; groupId?: string }): React.ReactNode => {
    const idx = layerBlocks.indexOf(b);
    const selected = selectedRowIds.has(b.id);
    const locked = rowLocked(b);
    return (
      <Fragment key={b.id}>
        <div
          className={`timeline-header-row ${selected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
          style={{ height: ROW_H, paddingLeft: depth * 16 + 8 }}
        >
          <span
            className="tl-grip"
            title="Drag to reorder (restacks immediately; selected rows move together)"
            onPointerDown={(e) => startRowDrag(e, b, parent, idx, layerBlocks.length)}
          >
            {'\u22EE\u22EE'}
          </span>
          {b.type === 'group' ? (
            <button
              className="tl-expand-btn"
              onPointerDown={(e) => toggleGroup(e, b.id)}
              title={expandedGroups.has(b.id) ? 'Collapse group' : 'Expand group'}
            >
              {expandedGroups.has(b.id) ? '\u25BC' : '\u25B6'}
            </button>
          ) : (
            <span className="tl-expand-spacer" />
          )}

          <span className="tl-block-name" title={blockDisplayName(b)} onPointerDown={(e) => { if (!multiSelectRow(e, b.id)) { select({ blockId: b.id, blockIds: [] }); startRowDrag(e, b, parent, idx, layerBlocks.length); } }}>
            {blockDisplayName(b)}
          </span>

          <div className="tl-row-actions">
            <button
              className={`tl-row-action-btn ${b.locked ? 'on' : ''}`}
              title={b.locked ? 'Unlock (allow editing)' : 'Lock (prevent moves, resizes, retiming)'}
              onPointerDown={(e) => { e.stopPropagation(); updateBlock(b.id, (blk) => { blk.locked = blk.locked ? undefined : true; }); }}
            >
              {b.locked ? '\u{1F512}' : '\u{1F513}'}
            </button>
            <button className="tl-row-action-btn" style={{ opacity: b.editorHidden ? 0.5 : 1 }} title="Toggle visibility in editor" onPointerDown={(e) => { e.stopPropagation(); updateBlock(b.id, blk => { blk.editorHidden = !blk.editorHidden; }, false); }}>
              {b.editorHidden ? '\uD83D\uDD76\uFE0F' : '\uD83D\uDC41\uFE0F'}
            </button>
            {/* Rows list top-most first (the lists are reversed), so index 0
                is already frontmost - it can't come further forward. */}
            <button className="tl-row-action-btn" title="Bring forward" disabled={idx <= 0} onPointerDown={(e) => { e.stopPropagation(); moveBlockZ(b.id, 'forward'); }}>{'\u25B2'}</button>
            <button className="tl-row-action-btn" title="Send backward" disabled={idx >= layerBlocks.length - 1} onPointerDown={(e) => { e.stopPropagation(); moveBlockZ(b.id, 'backward'); }}>{'\u25BC'}</button>
          </div>
        </div>
        {b.type === 'group' && expandedGroups.has(b.id) && (
          <Fragment key={b.id + '_children_headers'}>
            {/* Reversed like top-level rows: top of the list = paints on top. */}
            {[...((b.props as any).blocks as Block[])].reverse().map((child, _i, arr) => renderHeaderRow(child, arr, depth + 1, { groupId: b.id }))}
          </Fragment>
        )}
      </Fragment>
    );
  };

  // Render the right-hand column lanes recursively
  const renderLaneRow = (b: Block, _layerBlocks: Block[], depth = 0): React.ReactNode => {
    const start = b.timing?.start ?? 0;
    const end = b.timing?.end ?? duration;
    const selected = selectedRowIds.has(b.id);
    const untimed = !b.timing;
    const locked = rowLocked(b);
    const span = Math.max(0.2, end - start);
    const animIn = b.timing?.animIn?.duration ?? 0;
    const animOut = b.timing?.animOut?.duration ?? 0;
    return (
      <Fragment key={b.id}>
        <div className={`timeline-lane-row ${selected ? 'selected' : ''}`} style={{ height: ROW_H }} onPointerDown={(e) => { if (!multiSelectRow(e, b.id)) select({ blockId: b.id, blockIds: [] }); }}>
          <div
            className={`timeline-bar ${selected ? 'selected' : ''} ${untimed ? 'untimed' : ''} ${locked ? 'locked' : ''}`}
            style={{ left: pct(start), width: pct(span) }}
            onPointerDown={(e) => onDown(e, b.id, 'move')}
            title={locked ? 'Locked - unlock to retime' : untimed ? 'Whole slide - drag to add timing' : `${start.toFixed(1)}s - ${end.toFixed(1)}s`}
          >
            {!untimed && animIn > 0 && <div className="tl-ramp tl-ramp-in" style={{ width: `${(animIn / span) * 100}%` }} />}
            {!untimed && animOut > 0 && <div className="tl-ramp tl-ramp-out" style={{ width: `${(animOut / span) * 100}%` }} />}
            {b.type === 'audio' && <BarWaveform src={(b.props as { src?: string }).src} />}

            {/* Anim handles (hidden while locked - keyframes can't be dragged) */}
            {!untimed && !locked && (
              <div className="tl-ramp-strip" onPointerDown={(e) => e.stopPropagation()}>
                <span className="tl-ramp-handle in" style={{ left: `${(animIn / span) * 100}%` }} onPointerDown={(e) => onDown(e, b.id, 'animIn')} title="Drag to set animate-in length" />
                <span className="tl-ramp-handle out" style={{ right: `${(animOut / span) * 100}%` }} onPointerDown={(e) => onDown(e, b.id, 'animOut')} title="Drag to set animate-out length" />
              </div>
            )}
            {!locked && <span className="timeline-bar-handle start" onPointerDown={(e) => onDown(e, b.id, 'trimStart')} title="Drag to change the start (trims, doesn't move)" />}
            {!locked && <span className="timeline-bar-handle" onPointerDown={(e) => onDown(e, b.id, 'trim')} title="Drag to trim the end" />}
          </div>
        </div>
        {b.type === 'group' && expandedGroups.has(b.id) && (
          <Fragment key={b.id + '_children_lanes'}>
            {[...((b.props as any).blocks as Block[])].reverse().map((child, _i, arr) => renderLaneRow(child, arr, depth + 1))}
          </Fragment>
        )}
      </Fragment>
    );
  };

  return (
    <div className="timeline-panel" style={maxHeight ? { maxHeight, height: maxHeight } : undefined}>
      <div className="timeline-head">
        <span className="timeline-title">Timeline</span>
        {onCollapse && <button className="btn btn-ghost btn-icon" onClick={onCollapse} title="Hide the timeline">{'\u2013'}</button>}
        <button
          className={`btn btn-icon tl-play ${playing ? 'on' : ''}`}
          title={playing ? 'Pause the preview' : 'Play the timeline: previews animations and audio on the canvas (from the playhead, or the start)'}
          onClick={() => (playing ? stopPlay(scrubT ?? undefined) : startPlay())}
        >
          {playing ? '\u23f8' : '\u25b6'}
        </button>
        <button
          className="btn btn-ghost btn-icon"
          title="Add a cue marker at the playhead (usable in triggers)"
          onClick={addCue}
        >
          {'\u25c7'}
        </button>
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Zoom</span>
          <input type="range" min="1" max="5" step="0.1" value={timelineZoom} onChange={(e) => setTimelineZoom(parseFloat(e.target.value))} style={{ width: 60 }} />
        </div>
        <label className="tl-snap">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          snap
        </label>
        <button
          className={`btn btn-ghost tl-row-action-btn ${slide.layers.every((l) => l.locked) ? 'on' : ''}`}
          title={slide.layers.every((l) => l.locked) ? 'Unlock all layers' : 'Lock all layers (prevents every move, resize, and retime)'}
          onClick={() =>
            mutate((p) => {
              const s = p.slides.find((sl) => sl.id === slide.id);
              if (!s) return;
              const lockAll = !s.layers.every((l) => l.locked);
              s.layers.forEach((l) => { l.locked = lockAll ? true : undefined; });
            })
          }
        >
          {slide.layers.every((l) => l.locked) ? '\u{1F512} all' : '\u{1F513} all'}
        </button>
        {scrubT !== null && (
          <button
            className="btn btn-ghost tl-playhead-chip"
            title="Clear the playhead (show everything at rest)"
            onClick={() => setScrubT(null)}
          >
            {'⏱'} {scrubT.toFixed(1)}s {'✕'}
          </button>
        )}
        <span className="hint">
          {driven ? 'Length is set by the narration on this slide.' : 'Drag bars to move; ends to trim; the ticks set animate-in/out.'}
        </span>
      </div>

      <div className="timeline-container">
        {/* Left locked headers column */}
        <div className="timeline-headers-col">
          <div className="timeline-header-cell ruler-header">
            <span>Blocks</span>
          </div>
          {slide.layers.map((layer, li) => {
            const ordered = [...layer.blocks].reverse();
            return (
              <div key={layer.id}>
                <div className="timeline-layer-header-name">
                  <span>{layer.name}{li === 0 ? ' (base)' : ''}</span>
                  <button
                    className={`tl-row-action-btn ${layer.locked ? 'on' : ''}`}
                    title={layer.locked ? 'Unlock this layer' : 'Lock this whole layer'}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      mutate((p) => {
                        const l = p.slides.find((sl) => sl.id === slide.id)?.layers.find((x) => x.id === layer.id);
                        if (l) l.locked = l.locked ? undefined : true;
                      });
                    }}
                  >
                    {layer.locked ? '\u{1F512}' : '\u{1F513}'}
                  </button>
                </div>
                {ordered.map((b) => renderHeaderRow(b, ordered, 0, { layerId: layer.id }))}
              </div>
            );
          })}
        </div>

        {/* Right scrollable grid column */}
        <div className="timeline-grid-col" ref={trackRef} onPointerDown={() => select({ blockId: null, blockIds: [] })}>
          <div className="timeline-grid-scroll-content" style={{ width: `${timelineZoom * 100}%` }}>
            {/* Ruler: click or drag to place the playhead */}
            <div
              className="timeline-ruler scrubbable"
              style={{ position: 'sticky', top: 0, height: 20, left: 'auto', right: 'auto', zIndex: 8, background: 'var(--panel-2)' }}
              title="Click or drag to seek - the canvas previews this moment"
              onPointerDown={onRulerDown}
            >
              {ticks.map((s) => (
                <span key={s} className="timeline-tick" style={{ left: pct(s) }}>{s}s</span>
              ))}
              {cues.map((c) => (
                <span
                  key={c.id}
                  className="timeline-cue-flag"
                  style={{ left: pct(Math.min(c.time, duration)) }}
                  title={`${c.name} @ ${c.time.toFixed(1)}s — click to seek, right-click to delete`}
                  onPointerDown={(e) => { e.stopPropagation(); setScrubT(c.time); }}
                  onContextMenu={(e) => { e.preventDefault(); if (confirm(`Delete cue "${c.name}"?`)) removeCue(c.id); }}
                >
                  ◇ {c.name}
                </span>
              ))}
            </div>

            {/* Cue guide lines down the lane grid */}
            {cues.map((c) => (
              <div key={c.id} className="timeline-cue-line" style={{ left: pct(Math.min(c.time, duration)) }} />
            ))}

            {scrubT !== null && (
              <div className="timeline-playhead" style={{ left: pct(Math.min(scrubT, duration)) }}>
                <div className="timeline-playhead-cap" />
              </div>
            )}

            {/* Overflow Shading & Setmark */}
            {duration > slide.timeline.duration + 0.01 && (
              <>
                <div className="timeline-overflow" style={{ left: pct(slide.timeline.duration) }} />
                <div className="timeline-setmark" style={{ left: pct(slide.timeline.duration) }} title={`Set length: ${slide.timeline.duration}s (content runs to ${duration.toFixed(1)}s)`}>
                  <span className="timeline-setmark-label">set {slide.timeline.duration}s</span>
                </div>
              </>
            )}

            {/* Lanes */}
            {slide.layers.map((layer) => {
              const ordered = [...layer.blocks].reverse();
              return (
                <div key={layer.id}>
                  <div className="timeline-layer-lane-spacer" />
                  {ordered.map((b) => renderLaneRow(b, ordered, 0))}
                </div>
              );
            })}
          </div>
        </div>
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
