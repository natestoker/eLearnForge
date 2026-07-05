import { useEffect, useRef, useState } from 'react';
import type { Block, Layer } from '../schema/types';
import { useCurrentSlide, useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { BLOCKS } from '../blocks/registry';

const GRID = 8;
const MIN_SIZE = 40;

const snap = (v: number, disable: boolean) => (disable ? Math.round(v) : Math.round(v / GRID) * GRID);

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: { id: HandleId; l: number; t: number; r: number; b: number }[] = [
  { id: 'nw', l: 1, t: 1, r: 0, b: 0 },
  { id: 'n', l: 0, t: 1, r: 0, b: 0 },
  { id: 'ne', l: 0, t: 1, r: 1, b: 0 },
  { id: 'e', l: 0, t: 0, r: 1, b: 0 },
  { id: 'se', l: 0, t: 0, r: 1, b: 1 },
  { id: 's', l: 0, t: 0, r: 0, b: 1 },
  { id: 'sw', l: 1, t: 0, r: 0, b: 1 },
  { id: 'w', l: 1, t: 0, r: 0, b: 0 }
];

interface Gesture {
  kind: 'move' | 'resize';
  blockId: string;
  startClientX: number;
  startClientY: number;
  start: { x: number; y: number; w: number; h: number };
  handle?: { l: number; t: number; r: number; b: number };
  // For multi-move: every selected block's starting position, keyed by id.
  group?: Record<string, { x: number; y: number }>;
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
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
          const cx = (e.clientX - rect.left) / scale;
          const cy = (e.clientY - rect.top) / scale;
          const x = Math.min(m.startX, cx);
          const y = Math.min(m.startY, cy);
          const w = Math.abs(cx - m.startX);
          const h = Math.abs(cy - m.startY);
          m.x = x; m.y = y; m.w = w; m.h = h;
          setMarquee({ x, y, w, h });
          const hits: string[] = [];
          const layer = slide.layers.find((l) => l.id === selection.layerId) ?? slide.layers[0];
          for (const b of layer.blocks) {
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
      const dx = (e.clientX - g.startClientX) / scale;
      const dy = (e.clientY - g.startClientY) / scale;

      updateBlock(
        g.blockId,
        (b) => {
          if (g.kind === 'move') {
            b.x = snap(g.start.x + dx, noSnap);
            b.y = snap(g.start.y + dy, noSnap);
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
            b.x = x; b.y = y; b.w = w; b.h = h;
          }
        },
        false
      );

      // Multi-move: shift every other selected block by the same delta.
      if (g.kind === 'move' && g.group) {
        for (const [id, p0] of Object.entries(g.group)) {
          if (id === g.blockId) continue;
          updateBlock(id, (b) => {
            b.x = snap(p0.x + dx, noSnap);
            b.y = snap(p0.y + dy, noSnap);
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

      const blockId = store.selection.blockId;
      if (!blockId) return;

      const step = e.shiftKey ? GRID * 2 : 1;
      const nudge = (dx: number, dy: number) => {
        e.preventDefault();
        // Coalesce a burst of nudges into one undo step.
        const now = Date.now();
        if (now - lastNudgeRef.current > 600) record();
        lastNudgeRef.current = now;
        updateBlock(blockId, (b) => { b.x += dx; b.y += dy; }, false);
      };

      switch (e.key) {
        case 'ArrowLeft': nudge(-step, 0); break;
        case 'ArrowRight': nudge(step, 0); break;
        case 'ArrowUp': nudge(0, -step); break;
        case 'ArrowDown': nudge(0, step); break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          deleteBlock(blockId);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [record, updateBlock, deleteBlock]);

  const startMove = (e: React.PointerEvent, block: Block, layer: Layer) => {
    if (e.button !== 0) return;
    const allBlocks = slide.layers.flatMap((l) => l.blocks);
    // Grouped blocks act as one: clicking any member selects the whole group.
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
      select({ blockId: block.id, layerId: layer.id, blockIds: [...cur] });
      return;
    }
    // If the pressed block is in a group, or part of the existing
    // multi-selection, drag them all together.
    const currentIds = new Set([...(selection.blockIds ?? []), ...(selection.blockId ? [selection.blockId] : [])]);
    let dragIds: Set<string>;
    if (groupMembers) {
      dragIds = new Set(groupMembers);
      select({ blockId: block.id, layerId: layer.id, blockIds: groupMembers.filter((id) => id !== block.id) });
    } else if (currentIds.has(block.id) && currentIds.size > 1) {
      dragIds = currentIds;
      select({ blockId: block.id, layerId: layer.id, blockIds: [...currentIds].filter((id) => id !== block.id) });
    } else {
      dragIds = new Set([block.id]);
      select({ blockId: block.id, layerId: layer.id, blockIds: [] });
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

  const selectedLayerIndex = slide.layers.findIndex((l) => l.id === selection.layerId);

  return (
    <div className="canvas-area" ref={containerRef}>
      <div
        className="stage"
        style={{ width: slide.width, height: slide.height, transform: `scale(${scale})` }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          // Empty-canvas press starts a marquee. Shift keeps the current
          // selection and adds to it.
          const rect = e.currentTarget.getBoundingClientRect();
          const sx = (e.clientX - rect.left) / scale;
          const sy = (e.clientY - rect.top) / scale;
          if (!e.shiftKey) select({ blockId: null, blockIds: [] });
          marqueeRef.current = { startX: sx, startY: sy, x: sx, y: sy, w: 0, h: 0, additive: e.shiftKey };
          setMarquee({ x: sx, y: sy, w: 0, h: 0 });
        }}
      >
        {marquee && (marquee.w > 2 || marquee.h > 2) && (
          <div
            className="marquee"
            style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
          />
        )}
        {slide.layers.map((layer, layerIndex) => {
          if (hiddenLayerIds[layer.id]) return null;
          const dimmed = selectedLayerIndex > 0 && layerIndex !== selectedLayerIndex;
          return (
            <div key={layer.id} className={`stage-layer ${dimmed ? 'dimmed' : ''}`}>
              {layer.blocks.map((block) => {
                const def = BLOCKS[block.type];
                const isSelected = selection.blockId === block.id;
                const isMultiSel = isSelected || (selection.blockIds ?? []).includes(block.id);
                return (
                  <div
                    key={block.id}
                    className={`stage-block ${isSelected ? 'selected' : ''} ${isMultiSel && !isSelected ? 'co-selected' : ''}`}
                    style={{ left: block.x, top: block.y, width: block.w, height: block.h }}
                    onPointerDown={(e) => startMove(e, block, layer)}
                  >
                    <def.Canvas
                      block={block}
                      selected={isSelected}
                      onUpdateProps={(fn, history = true) =>
                        updateBlock(block.id, (b) => fn(b.props), history)
                      }
                    />
                    {isSelected && (
                      <>
                        {HANDLES.map((h) => (
                          <div
                            key={h.id}
                            className={`handle handle-${h.id}`}
                            onPointerDown={(e) => startResize(e, block, h)}
                          />
                        ))}
                        <div className="block-badge">{def.label}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="canvas-meta">
        <span>
          {slide.width} x {slide.height} @ {(scale * 100).toFixed(0)}%
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
    </div>
  );
}
