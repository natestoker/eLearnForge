import { useEffect, useRef, useState } from 'react';
import type { Block, Layer, ShapeProps } from '../schema/types';
import { selectedIds, useCurrentSlide, useProjectStore, walkBlocks } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { BLOCKS } from '../blocks/registry';
import { CALLOUT_BODY, DEFAULT_TAIL } from '../blocks/shape/geometry';
import { blockStateAt, styleFor, timelineDuration } from '../engine/timeline';
import { motionPoints } from '../engine/motionPath';
import { shadowStyle } from '../shared/shadow';

const GRID = 8;
const MIN_SIZE = 40;
// Pasteboard margin around the slide, in stage units: objects staged here
// are visible and editable but sit outside the slide (the player clips
// them). Scrollable like Illustrator's artboard surround.
const PASTEBOARD = 320;

// Authoring lock: a block is locked by its own padlock or its layer's.
// Locked blocks stay selectable (so the lock is discoverable) but refuse
// moves, resizes, nudges, deletes, and timeline drags.
export function isBlockLocked(block: Block, layer?: Layer): boolean {
  return Boolean(block.locked || layer?.locked);
}

const snap = (v: number, disable: boolean) => (disable ? Math.round(v) : Math.round(v / GRID) * GRID);

// Alignment guides: a fixed number of slide px (not screen px, so the
// magnetism feels the same at any zoom) - checks a block's leading edge,
// center, and trailing edge against every guide on that axis and returns
// whichever correction is closest, or the position unchanged if nothing is
// within range.
const GUIDE_SNAP = 6;
function snapToGuides(pos: number, size: number, guidePositions: number[], threshold = GUIDE_SNAP): number {
  let best = pos;
  let bestAbs = threshold;
  for (const gp of guidePositions) {
    for (const edge of [pos, pos + size / 2, pos + size]) {
      const d = gp - edge;
      if (Math.abs(d) < bestAbs) { bestAbs = Math.abs(d); best = pos + d; }
    }
  }
  return best;
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: { id: HandleId; l: number; t: number; r: number; b: number }[] = [
  { id: 'nw', l: 1, t: 1, r: 0, b: 0 },
  { id: 'n', l: 0, t: 1, r: 0, b: 0 },
  { id: 'ne', l: 0, t: 1, r: 1, b: 0 },
  { id: 'e', l: 0, t: 0, r: 1, b: 0 },
  { id: 'se', l: 0, t: 0, r: 1, b: 1 },
  { id: 's', l: 0, t: 0, r: 0, b: 1 },
  { id: 'sw', l: 1, t: 0, r: 0, b: 1 },
  { id: 'w', l: 1, t: 0, r: 0, b: 0 }
];

export function BlockNode({
  block,
  layer,
  selection,
  updateBlock,
  startMove,
  startResize,
  startTail,
  startMotion,
  previewStyle
}: {
  block: Block;
  layer?: Layer;
  selection: { blockId: string | null; blockIds?: string[] };
  updateBlock: (id: string, fn: (b: Block) => void, history?: boolean) => void;
  startMove: (e: React.PointerEvent, block: Block, layer?: Layer) => void;
  startResize: (e: React.PointerEvent, block: Block, h: any) => void;
  startTail?: (e: React.PointerEvent, block: Block) => void;
  startMotion?: (e: React.PointerEvent, block: Block) => void;
  previewStyle?: React.CSSProperties;
}) {
  const openPen = useUiStore((s) => s.openPenEditor);
  if (block.editorHidden) return null;
  const def = BLOCKS[block.type];
  const isSelected = selection.blockId === block.id;
  const isMultiSel = isSelected || (selection.blockIds ?? []).includes(block.id);
  const shapeProps = block.type === 'shape' ? (block.props as ShapeProps) : null;
  const isCallout = Boolean(shapeProps && CALLOUT_BODY[shapeProps.kind] && !shapeProps.points && !shapeProps.nodes?.length);
  const tail = shapeProps?.tail ?? DEFAULT_TAIL;
  const locked = isBlockLocked(block, layer);
  return (
    <div
      className={`stage-block ${isSelected ? 'selected' : ''} ${isMultiSel && !isSelected ? 'co-selected' : ''} ${locked ? 'locked' : ''}`}
      style={{ left: block.x, top: block.y, width: block.w, height: block.h, ...previewStyle }}
      onPointerDown={(e) => startMove(e, block, layer)}
      onDoubleClick={
        block.type === 'group'
          ? (e) => {
              // Drill into the group: select the top-most child under the
              // cursor so its properties (color, text...) are editable.
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const lx = ((e.clientX - rect.left) / rect.width) * block.w;
              const ly = ((e.clientY - rect.top) / rect.height) * block.h;
              const children = (block.props as { blocks: Block[] }).blocks;
              for (let i = children.length - 1; i >= 0; i--) {
                const c = children[i];
                if (lx >= c.x && lx <= c.x + c.w && ly >= c.y && ly <= c.y + c.h) {
                  useProjectStore.getState().select({ blockId: c.id, blockIds: [] });
                  return;
                }
              }
            }
          : undefined
      }
      onContextMenu={
        block.type === 'shape' || block.type === 'image'
          ? (e) => {
              // Right-click a shape (or image) to edit its geometry with the
              // pen tool; preset shapes seed the editor with their points.
              e.preventDefault();
              e.stopPropagation();
              openPen(block.id, block.type === 'shape' ? 'shape' : 'imageClip');
            }
          : undefined
      }
    >
      {/* Shadow wrapper: outer shadows are a drop-shadow filter here so they
          follow the real silhouette (SVG geometry, callout tails, clipped
          images); inner shadows on non-shape blocks approximate with an
          inset box-shadow. Shape blocks draw inner shadows themselves. */}
      <div style={{ width: '100%', height: '100%', ...shadowStyle(block) }}>
        <def.Canvas
          block={block}
          selected={isSelected}
          onUpdateProps={(fn, history = true) =>
            updateBlock(block.id, (b) => fn(b.props), history)
          }
        />
      </div>
      {isSelected && !locked && (
        <>
          {HANDLES.map((h) => (
            <div
              key={h.id}
              className={`handle handle-${h.id}`}
              onPointerDown={(e) => startResize(e, block, h)}
            />
          ))}
          {isCallout && startTail && (
            <div
              className="tail-handle"
              style={{ left: `${tail.x}%`, top: `${tail.y}%` }}
              title="Drag to move the callout tail"
              onPointerDown={(e) => startTail(e, block)}
            />
          )}
          {block.motion && startMotion && (() => {
            const pts = motionPoints(block.motion);
            const cx = block.w / 2, cy = block.h / 2;
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${cx + p.x},${cy + p.y}`).join(' ');
            const hv = block.motion.vector;
            return (
              <>
                <svg className="motion-overlay" style={{ position: 'absolute', left: 0, top: 0, width: block.w, height: block.h, overflow: 'visible', pointerEvents: 'none' }}>
                  <path d={d} fill="none" stroke="#f0b429" strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                </svg>
                <div
                  className="motion-handle"
                  style={{ left: cx + hv.x, top: cy + hv.y }}
                  title="Drag to set the motion path endpoint"
                  onPointerDown={(e) => startMotion(e, block)}
                />
              </>
            );
          })()}
          <div className="block-badge">{def.label}</div>
        </>
      )}
      {isSelected && locked && <div className="block-badge locked">{'\u{1F512}'} {def.label} (locked)</div>}
      {!isSelected && locked && <div className="lock-glyph" title="Locked - unlock from its timeline row or layer">{'\u{1F512}'}</div>}
    </div>
  );
}

interface Gesture {
  kind: 'move' | 'resize' | 'tail' | 'groupResize' | 'motion';
  blockId: string;
  startClientX: number;
  startClientY: number;
  start: { x: number; y: number; w: number; h: number };
  handle?: { l: number; t: number; r: number; b: number };
  // For motion drags: the path's control vector at gesture start (px).
  motionVec?: { x: number; y: number };
  // For multi-move: every selected block's starting position, keyed by id.
  group?: Record<string, { x: number; y: number }>;
  // For tail drags: the callout tail's starting point (0..100 space).
  tail?: { x: number; y: number };
  // For groupResize: every selected block's full starting rect; `start`
  // holds the selection bounding box the scale factors derive from.
  rects?: Record<string, { x: number; y: number; w: number; h: number }>;
}

interface Marquee {
  startX: number; startY: number; // stage coords
  x: number; y: number; w: number; h: number;
  additive: boolean;
}

export function EditorCanvas() {
  const slide = useCurrentSlide();
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const record = useProjectStore((s) => s.record);
  const snapEnabled = useUiStore((s) => s.snapEnabled);
  const setSnapEnabled = useUiStore((s) => s.setSnapEnabled);
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const deleteBlock = useProjectStore((s) => s.deleteBlock);
  const hiddenLayerIds = useUiStore((s) => s.hiddenLayerIds);
  const addGuide = useProjectStore((s) => s.addGuide);
  const removeGuide = useProjectStore((s) => s.removeGuide);
  const moveGuide = useProjectStore((s) => s.moveGuide);
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number; slideX: number; slideY: number } | null>(null);

  useEffect(() => {
    if (!canvasMenu) return;
    const close = () => setCanvasMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [canvasMenu]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit');
  const [manualScale, setManualScale] = useState(1);
  const activeScale = zoomMode === 'fit' ? scale : manualScale;
  const gestureRef = useRef<Gesture | null>(null);
  const marqueeRef = useRef<Marquee | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const lastNudgeRef = useRef(0);

  // Fit the fixed-size stage to the available area.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const pad = 56;
      const s = Math.min(
        (el.clientWidth - pad) / slide.width,
        (el.clientHeight - pad) / slide.height
      );
      setScale(Math.max(0.1, Math.min(s, 1.5)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slide.width, slide.height]);

  // Keep the slide centered in view when the pasteboard overflows: scroll
  // to the middle on slide/zoom changes (margin:auto handles the
  // small-enough case).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
    el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
  }, [slide.id, activeScale]);

  // Drag / resize: record() once at gesture start, silent updates during,
  // so the whole gesture is one undo step.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Marquee selection: update the rectangle and live-select intersecting
      // blocks on the current layer.
      const m = marqueeRef.current;
      if (m) {
        const stageEl = containerRef.current?.querySelector('.stage') as HTMLElement | null;
        if (stageEl) {
          const rect = stageEl.getBoundingClientRect();
          const cx = (e.clientX - rect.left) / activeScale;
          const cy = (e.clientY - rect.top) / activeScale;
          const x = Math.min(m.startX, cx);
          const y = Math.min(m.startY, cy);
          const w = Math.abs(cx - m.startX);
          const h = Math.abs(cy - m.startY);
          m.x = x; m.y = y; m.w = w; m.h = h;
          setMarquee({ x, y, w, h });
          const hits: string[] = [];
          const layer = slide.layers.find((l) => l.id === selection.layerId) ?? slide.layers[0];
          for (const b of layer.blocks) {
            if (b.editorHidden || isBlockLocked(b, layer)) continue;
            const ix = b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y;
            if (ix) hits.push(b.id);
          }
          const base = m.additive ? new Set([...(selection.blockIds ?? []), ...(selection.blockId ? [selection.blockId] : [])]) : new Set<string>();
          hits.forEach((id) => base.add(id));
          const ids = [...base];
          if (ids.length) select({ blockId: ids[ids.length - 1], layerId: layer.id, blockIds: ids.slice(0, -1) });
          else select({ blockId: null, blockIds: [] });
        }
        return;
      }
      const g = gestureRef.current;
      if (!g) return;
      // Toggle is the base mode; holding Alt inverts it for one gesture.
      const snapOn = useUiStore.getState().snapEnabled;
      const noSnap = e.altKey ? snapOn : !snapOn;
      const dx = (e.clientX - g.startClientX) / activeScale;
      const dy = (e.clientY - g.startClientY) / activeScale;

      // Resize the whole multi-selection about its bounding-box origin.
      // Shift keeps the box's aspect (the larger factor wins).
      if (g.kind === 'groupResize' && g.rects) {
        let sx = Math.max(0.05, (g.start.w + dx) / g.start.w);
        let sy = Math.max(0.05, (g.start.h + dy) / g.start.h);
        if (e.shiftKey) { const s = Math.max(sx, sy); sx = s; sy = s; }
        for (const [id, r0] of Object.entries(g.rects)) {
          updateBlock(id, (b) => {
            b.x = Math.round(g.start.x + (r0.x - g.start.x) * sx);
            b.y = Math.round(g.start.y + (r0.y - g.start.y) * sy);
            b.w = Math.max(MIN_SIZE, Math.round(r0.w * sx));
            b.h = Math.max(MIN_SIZE, Math.round(r0.h * sy));
          }, false);
        }
        return;
      }

      // Guide-snap only the block being dragged; the rest of a multi-move
      // follows in lockstep below (its exact delta, not each member
      // re-snapping independently - that's what made multi-drags feel "off",
      // per the align-to-key-object request this pairs with).
      let movedNX = 0, movedNY = 0;
      updateBlock(
        g.blockId,
        (b) => {
          if (g.kind === 'move') {
            let nx = snap(g.start.x + dx, noSnap);
            let ny = snap(g.start.y + dy, noSnap);
            if (!noSnap && slide.guides?.length) {
              const vGuides = slide.guides.filter((gd) => gd.axis === 'v').map((gd) => gd.pos);
              const hGuides = slide.guides.filter((gd) => gd.axis === 'h').map((gd) => gd.pos);
              nx = snapToGuides(nx, g.start.w, vGuides);
              ny = snapToGuides(ny, g.start.h, hGuides);
            }
            b.x = nx; b.y = ny;
            movedNX = nx; movedNY = ny;
          } else if (g.kind === 'tail' && g.tail) {
            // Callout tail: deltas map into the shape's 0..100 space; the
            // tip may go well past the block bounds, Storyline-style.
            const sp = b.props as ShapeProps;
            sp.tail = {
              x: Math.round(Math.max(-100, Math.min(200, g.tail.x + (dx / g.start.w) * 100)) * 10) / 10,
              y: Math.round(Math.max(-100, Math.min(200, g.tail.y + (dy / g.start.h) * 100)) * 10) / 10
            };
          } else if (g.kind === 'motion' && g.motionVec && b.motion) {
            // Motion path endpoint: px offset from the block's position.
            b.motion.vector = { x: Math.round(g.motionVec.x + dx), y: Math.round(g.motionVec.y + dy) };
          } else if (g.handle) {
            let { x, y, w, h } = g.start;
            if (g.handle.r) w = Math.max(MIN_SIZE, snap(g.start.w + dx, noSnap));
            if (g.handle.b) h = Math.max(MIN_SIZE, snap(g.start.h + dy, noSnap));
            if (g.handle.l) {
              const nx = snap(g.start.x + dx, noSnap);
              w = Math.max(MIN_SIZE, g.start.w + (g.start.x - nx));
              x = g.start.x + g.start.w - w;
            }
            if (g.handle.t) {
              const ny = snap(g.start.y + dy, noSnap);
              h = Math.max(MIN_SIZE, g.start.h + (g.start.y - ny));
              y = g.start.y + g.start.h - h;
            }
            // Shift keeps the starting aspect ratio: corners scale by the
            // dominant axis, edge handles derive the other dimension.
            if (e.shiftKey) {
              const corner = (g.handle.l || g.handle.r) && (g.handle.t || g.handle.b);
              if (corner) {
                const s = Math.max(w / g.start.w, h / g.start.h);
                w = Math.max(MIN_SIZE, Math.round(g.start.w * s));
                h = Math.max(MIN_SIZE, Math.round(g.start.h * s));
              } else if (g.handle.l || g.handle.r) {
                h = Math.max(MIN_SIZE, Math.round(w * (g.start.h / g.start.w)));
              } else {
                w = Math.max(MIN_SIZE, Math.round(h * (g.start.w / g.start.h)));
              }
              if (g.handle.l) x = g.start.x + g.start.w - w;
              if (g.handle.t) y = g.start.y + g.start.h - h;
            }
            b.x = x; b.y = y; b.w = w; b.h = h;
          }
        },
        false
      );

      // Multi-move: shift every other selected block by the SAME effective
      // delta the dragged block ended up with (post grid/guide snap), so the
      // whole selection travels together instead of each member rounding on
      // its own.
      if (g.kind === 'move' && g.group) {
        const effDx = movedNX - g.start.x;
        const effDy = movedNY - g.start.y;
        for (const [id, p0] of Object.entries(g.group)) {
          if (id === g.blockId) continue;
          updateBlock(id, (b) => {
            b.x = p0.x + effDx;
            b.y = p0.y + effDy;
          }, false);
        }
      }
    };
    const onUp = () => { gestureRef.current = null; marqueeRef.current = null; setMarquee(null); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [scale, updateBlock, slide, selection, select]);

  // Keyboard: nudge + delete when a block is selected and focus is not in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const store = useProjectStore.getState();

      // Clipboard: cut/copy/paste work across layers and slides. Paste drops
      // onto the currently selected layer, so cross-layer/slide is: select
      // the target layer/slide, then paste.
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'c') { store.copyBlocks(); return; }
        if (e.key === 'x') { e.preventDefault(); store.cutBlocks(); return; }
        if (e.key === 'v') { e.preventDefault(); store.pasteBlocks(); return; }
        if (e.key === 'd') { e.preventDefault(); store.duplicateBlocks(); return; }
        if (e.key === 'g') { e.preventDefault(); if (e.shiftKey) store.ungroupBlocks(); else store.groupBlocks(); return; }
      }

      // Arrows/Delete act on the WHOLE selection, not just the primary block.
      const ids = selectedIds(store.selection);
      if (!ids.length) return;

      // Only unlocked blocks are movable/deletable; a locked block in the
      // selection is simply skipped (the rest still move).
      const slideNow = store.project.slides.find((sl) => sl.id === store.selection.slideId);
      const lockedSet = new Set<string>();
      for (const l of slideNow?.layers ?? []) {
        for (const b of walkBlocks(l.blocks)) if (isBlockLocked(b, l)) lockedSet.add(b.id);
      }
      const movable = ids.filter((id) => !lockedSet.has(id));
      if (!movable.length) return;

      const step = e.shiftKey ? GRID * 2 : 1;
      const nudge = (dx: number, dy: number) => {
        e.preventDefault();
        // Coalesce a burst of nudges into one undo step.
        const now = Date.now();
        if (now - lastNudgeRef.current > 600) record();
        lastNudgeRef.current = now;
        // First mutation carries no history (record() above owns the step),
        // and every selected block moves by the same delta.
        movable.forEach((id) => updateBlock(id, (b) => { b.x += dx; b.y += dy; }, false));
      };

      switch (e.key) {
        case 'ArrowLeft': nudge(-step, 0); break;
        case 'ArrowRight': nudge(step, 0); break;
        case 'ArrowUp': nudge(0, -step); break;
        case 'ArrowDown': nudge(0, step); break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          movable.forEach((id) => deleteBlock(id));
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [record, updateBlock, deleteBlock]);

  const startMove = (e: React.PointerEvent, block: Block, layer?: Layer) => {
    if (e.button !== 0) return;
    const allBlocks = slide.layers.flatMap((l) => {
      const walk = (blocks: Block[]): Block[] => blocks.flatMap(b => b.type === 'group' ? [b, ...walk((b.props as any).blocks)] : [b]);
      return walk(l.blocks);
    });
    // Grouped blocks act as one (deprecated groupId path, though we'll keep it for now)
    const groupMembers = block.groupId
      ? allBlocks.filter((b) => b.groupId === block.groupId).map((b) => b.id)
      : null;

    if (e.shiftKey) {
      const cur = new Set(selection.blockIds ?? []);
      if (selection.blockId) cur.add(selection.blockId);
      const toToggle = groupMembers ?? [block.id];
      const allIn = toToggle.every((id) => cur.has(id) || id === block.id);
      for (const id of toToggle) { if (allIn) cur.delete(id); else cur.add(id); }
      cur.delete(block.id);
      const targetLayerId = layer?.id ?? selection.layerId;
      select({ blockId: block.id, layerId: targetLayerId, blockIds: [...cur] });
      return;
    }
    // If the pressed block is in a group, or part of the existing
    // multi-selection, drag them all together.
    const currentIds = new Set([...(selection.blockIds ?? []), ...(selection.blockId ? [selection.blockId] : [])]);
    let dragIds: Set<string>;
    const targetLayerId = layer?.id ?? selection.layerId;
    if (groupMembers) {
      dragIds = new Set(groupMembers);
      select({ blockId: block.id, layerId: targetLayerId, blockIds: groupMembers.filter((id) => id !== block.id) });
    } else if (currentIds.has(block.id) && currentIds.size > 1) {
      dragIds = currentIds;
      select({ blockId: block.id, layerId: targetLayerId, blockIds: [...currentIds].filter((id) => id !== block.id) });
    } else {
      dragIds = new Set([block.id]);
      select({ blockId: block.id, layerId: targetLayerId, blockIds: [] });
    }
    // Locked blocks select but never move; locked co-selected members stay
    // put while the rest of the selection drags.
    if (isBlockLocked(block, layer)) return;
    for (const id of [...dragIds]) {
      const bl = allBlocks.find((x) => x.id === id);
      if (bl && isBlockLocked(bl, layer)) dragIds.delete(id);
    }
    record();

    let group: Record<string, { x: number; y: number }> | undefined;
    if (dragIds.size > 1) {
      group = {};
      for (const id of dragIds) {
        const bl = allBlocks.find((x) => x.id === id);
        if (bl) group[id] = { x: bl.x, y: bl.y };
      }
    }
    gestureRef.current = {
      kind: 'move',
      blockId: block.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      start: { x: block.x, y: block.y, w: block.w, h: block.h },
      group
    };
  };

  const startResize = (e: React.PointerEvent, block: Block, handle: (typeof HANDLES)[number]) => {
    e.stopPropagation();
    record();
    gestureRef.current = {
      kind: 'resize',
      blockId: block.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      start: { x: block.x, y: block.y, w: block.w, h: block.h },
      handle
    };
  };

  const startTail = (e: React.PointerEvent, block: Block) => {
    e.stopPropagation();
    record();
    const tail = (block.props as ShapeProps).tail ?? DEFAULT_TAIL;
    gestureRef.current = {
      kind: 'tail',
      blockId: block.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      start: { x: block.x, y: block.y, w: block.w, h: block.h },
      tail: { ...tail }
    };
  };

  const startMotion = (e: React.PointerEvent, block: Block) => {
    e.stopPropagation();
    if (!block.motion) return;
    record();
    gestureRef.current = {
      kind: 'motion',
      blockId: block.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      start: { x: block.x, y: block.y, w: block.w, h: block.h },
      motionVec: { ...block.motion.vector }
    };
  };

  // Marquee can start ANYWHERE that isn't a block: the stage, the pasteboard
  // around it, or the outer canvas area. Coordinates are stage-relative and
  // may be negative - off-stage (pasteboard) objects select the same way.
  const startMarquee = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    const stageEl = containerRef.current?.querySelector('.stage') as HTMLElement | null;
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / activeScale;
    const sy = (e.clientY - rect.top) / activeScale;
    if (!e.shiftKey) select({ blockId: null, blockIds: [] });
    marqueeRef.current = { startX: sx, startY: sy, x: sx, y: sy, w: 0, h: 0, additive: e.shiftKey };
    setMarquee({ x: sx, y: sy, w: 0, h: 0 });
  };

  // Bounding box of the multi-selection (2+ blocks): one SE handle resizes
  // everything together, proportional with Shift.
  const selIds = [...(selection.blockIds ?? []), ...(selection.blockId ? [selection.blockId] : [])];
  const selBlocks = selIds.length >= 2
    ? slide.layers.flatMap((l) => l.blocks).filter((b) => selIds.includes(b.id) && !b.editorHidden)
    : [];
  const selBox = selBlocks.length >= 2
    ? {
        x: Math.min(...selBlocks.map((b) => b.x)),
        y: Math.min(...selBlocks.map((b) => b.y)),
        w: Math.max(...selBlocks.map((b) => b.x + b.w)) - Math.min(...selBlocks.map((b) => b.x)),
        h: Math.max(...selBlocks.map((b) => b.y + b.h)) - Math.min(...selBlocks.map((b) => b.y))
      }
    : null;
  const startGroupResize = (e: React.PointerEvent) => {
    if (!selBox) return;
    e.stopPropagation();
    record();
    const rects: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const b of selBlocks) {
      const layer = slide.layers.find((l) => l.blocks.includes(b));
      if (isBlockLocked(b, layer)) continue;
      rects[b.id] = { x: b.x, y: b.y, w: b.w, h: b.h };
    }
    gestureRef.current = {
      kind: 'groupResize',
      blockId: selBlocks[0].id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      start: selBox,
      rects
    };
  };

  const selectedLayerIndex = slide.layers.findIndex((l) => l.id === selection.layerId);

  // Timeline scrub preview: with a playhead set, each block renders in its
  // state at that moment - absent blocks ghost out (still clickable for
  // authoring), entering/exiting blocks show their animation mid-flight.
  const scrubT = useUiStore((s) => s.scrubT);
  const scrubDuration = timelineDuration(slide.timeline, slide.layers.flatMap((l) => walkBlocks(l.blocks)));
  const previewFor = (block: Block): React.CSSProperties | undefined => {
    if (scrubT === null || !slide.timeline) return undefined;
    const st = blockStateAt(scrubT, block.timing, scrubDuration, block.motion);
    if (!st.present) return { opacity: 0.15, filter: 'grayscale(0.8)' };
    const css = styleFor(st);
    delete css.pointerEvents; // authoring: everything stays selectable
    delete css.visibility;
    return css;
  };

  // Right-click the stage (not a block) to drop an alignment guide at that
  // position. Guides are author-only - never read by the player.
  const onStageContextMenu = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // a block/handle handles its own menu
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const slideX = (e.clientX - rect.left) / activeScale;
    const slideY = (e.clientY - rect.top) / activeScale;
    setCanvasMenu({ x: e.clientX, y: e.clientY, slideX, slideY });
  };

  const startGuideDrag = (e: React.PointerEvent, guideId: string, axis: 'h' | 'v') => {
    e.stopPropagation();
    e.preventDefault();
    const stageEl = containerRef.current?.querySelector('.stage') as HTMLElement | null;
    if (!stageEl) return;
    record();
    const onMove = (ev: PointerEvent) => {
      const rect = stageEl.getBoundingClientRect();
      const pos = axis === 'v' ? (ev.clientX - rect.left) / activeScale : (ev.clientY - rect.top) / activeScale;
      moveGuide(guideId, Math.max(0, pos));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    // Two layers: the scroller (.canvas-area) and, OUTSIDE it, the pinned
    // overlays (zoom, size/snap). Anything inside the scroller travels with
    // the pasteboard - which is exactly how the overlays ended up floating
    // over the slide before.
    <div className="canvas-wrap">
    <div
      className="canvas-area"
      ref={containerRef}
      style={{ overflow: 'auto', position: 'relative', display: 'flex' }}
      onPointerDown={startMarquee}
    >
      {/* Pasteboard: a scrollable margin around the slide. margin:auto keeps
          it centered while small AND fully reachable when it overflows (flex
          centering alone makes the left/top overflow unreachable). */}
      <div
        className="pasteboard"
        style={{
          width: (slide.width + PASTEBOARD * 2) * activeScale,
          height: (slide.height + PASTEBOARD * 2) * activeScale,
          flexShrink: 0,
          position: 'relative',
          margin: 'auto'
        }}
        onPointerDown={startMarquee}
      >
        <div
          className="stage"
          style={{
            width: slide.width,
            height: slide.height,
            transform: `scale(${activeScale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: PASTEBOARD * activeScale,
            left: PASTEBOARD * activeScale
          }}
          onPointerDown={startMarquee}
          onContextMenu={onStageContextMenu}
      >
        {marquee && (marquee.w > 2 || marquee.h > 2) && (
          <div
            className="marquee"
            style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
          />
        )}
        {(slide.guides ?? []).map((g) => (
          <div
            key={g.id}
            className={`stage-guide ${g.axis}`}
            style={g.axis === 'v'
              ? { left: g.pos - 4, top: 0, width: 8, height: slide.height }
              : { top: g.pos - 4, left: 0, height: 8, width: slide.width }}
            onPointerDown={(e) => startGuideDrag(e, g.id, g.axis)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); removeGuide(g.id); }}
            title="Drag to move - right-click to remove"
          />
        ))}
        {slide.layers.map((layer, layerIndex) => {
          if (hiddenLayerIds[layer.id]) return null;
          const dimmed = selectedLayerIndex > 0 && layerIndex !== selectedLayerIndex;
          return (
            <div key={layer.id} className={`stage-layer ${dimmed ? 'dimmed' : ''}`}>
              {layer.blocks.map((block) => (
                <BlockNode
                  key={block.id}
                  block={block}
                  layer={layer}
                  selection={selection}
                  updateBlock={updateBlock}
                  startMove={startMove}
                  startResize={startResize}
                  startTail={startTail}
                  startMotion={startMotion}
                  previewStyle={previewFor(block)}
                />
              ))}
            </div>
          );
        })}
        {selBox && (
          <div
            className="multi-bbox"
            style={{ left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h }}
          >
            <div
              className="handle handle-se multi"
              title="Drag to resize the selection together (Shift keeps proportions)"
              onPointerDown={startGroupResize}
            />
          </div>
        )}
      </div>
      </div>
    </div>
      <div className="canvas-zoom">
        <button className="btn btn-ghost" style={{ padding: '0 8px' }} onClick={() => { setZoomMode('manual'); setManualScale(() => Math.max(0.1, activeScale - 0.1)); }}>-</button>
        <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', width: 40, justifyContent: 'center' }}>{Math.round(activeScale * 100)}%</span>
        <button className="btn btn-ghost" style={{ padding: '0 8px' }} onClick={() => { setZoomMode('manual'); setManualScale(() => Math.min(3, activeScale + 0.1)); }}>+</button>
        <button className="btn btn-ghost" style={{ padding: '0 8px', marginLeft: 4 }} onClick={() => setZoomMode('fit')}>Fit</button>
        <button
          className="btn btn-ghost"
          style={{ padding: '0 8px' }}
          title="Preview from this slide"
          onClick={() => useUiStore.getState().setPreviewOpen(true, useProjectStore.getState().selection.slideId)}
        >{'▶'}</button>
      </div>
      <div className="canvas-meta">
        <span>
          {slide.width} x {slide.height} @ {(activeScale * 100).toFixed(0)}%
        </span>
        <label className="snap-toggle">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapEnabled(e.target.checked)}
          />
          snap {GRID}px (Alt inverts)
        </label>
      </div>
      {canvasMenu && (
        <div className="ctx-menu" style={{ left: canvasMenu.x, top: canvasMenu.y }} onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => { addGuide('v', canvasMenu.slideX); setCanvasMenu(null); }}>Add vertical guide here</button>
          <button onClick={() => { addGuide('h', canvasMenu.slideY); setCanvasMenu(null); }}>Add horizontal guide here</button>
        </div>
      )}
    </div>
  );
}
