import { useState, useRef, useEffect } from 'react';
import { useProjectStore, walkBlocks } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { Lucide } from './lucide';
import type { ImageProps, PathNode, ShapeProps } from '../schema/types';
import {
  SHAPE_POINTS, SHAPE_PATHS, nodesFromPoints, nodesFromPresetPath, pathFromNodes
} from '../blocks/shape/geometry';
import { freehandToNodes, polygonNodes, starNodes } from '../blocks/shape/pathTools';
import { largestOutline, parseSvgText } from '../blocks/shape/svgImport';

// The vector editor behind BOTH custom shapes and custom image clips - one
// engine, two targets (ShapeProps.nodes / ImageProps.clipNodes). It edits
// true Bezier paths, Illustrator-style:
//   - click empty space to append an anchor; click the outline to insert
//     one mid-segment (curves split exactly, de Casteljau)
//   - drag anchors to move them (handles follow)
//   - select an anchor to see its handles; drag a handle to bend the
//     adjacent segments; smooth anchors keep their handles mirrored
//   - Smooth / Corner / Straight convert the selected anchor
//   - double-click an anchor to delete it
// Points live in a 0..100 space (stretched to the block, the same model as
// preset geometry). Presets seed their real geometry - polygon presets as
// corner anchors, path presets (hearts, clouds) with their actual curves -
// so "edit this shape" starts from what's on the canvas. On apply, shape
// drawings are trimmed to their content: everything normalizes to the
// bounding box and the block resizes to match.

// The editor canvas matches the BLOCK's aspect ratio (it used to be a
// square, which distorted everything: art drawn true-to-life in the square
// stretched when applied to a non-square block). Same 0..100 space, just
// displayed at the block's real proportions - WYSIWYG.
const MAX_EDIT = 520;
const MIN_EDIT = 220;
function editSize(bw: number, bh: number): { w: number; h: number } {
  const ratio = Math.max(0.25, Math.min(4, bh / Math.max(1, bw)));
  let w = MAX_EDIT, h = MAX_EDIT * ratio;
  if (h > MAX_EDIT) { h = MAX_EDIT; w = MAX_EDIT / ratio; }
  return { w: Math.max(MIN_EDIT, Math.round(w)), h: Math.max(MIN_EDIT, Math.round(h)) };
}

function seedNodes(mode: 'shape' | 'imageClip', props: ShapeProps | ImageProps): PathNode[] {
  if (mode === 'imageClip') {
    const ip = props as ImageProps;
    if (ip.clipNodes?.length) return structuredClone(ip.clipNodes);
    if (ip.clipPoints) return nodesFromPoints(ip.clipPoints);
    if (ip.clipKind && SHAPE_POINTS[ip.clipKind]) return nodesFromPoints(SHAPE_POINTS[ip.clipKind]!);
    if (ip.clipKind && SHAPE_PATHS[ip.clipKind]) return nodesFromPresetPath(SHAPE_PATHS[ip.clipKind]!) ?? [];
    return [];
  }
  const sp = props as ShapeProps;
  if (sp.nodes?.length) return structuredClone(sp.nodes);
  if (sp.points) return nodesFromPoints(sp.points, sp.smooth);
  if (sp.kind === 'rectangle' || sp.kind === 'roundedRectangle') {
    return [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  }
  if (SHAPE_POINTS[sp.kind]) return nodesFromPoints(SHAPE_POINTS[sp.kind]!);
  if (SHAPE_PATHS[sp.kind]) return nodesFromPresetPath(SHAPE_PATHS[sp.kind]!) ?? [];
  return [];
}

// Give a corner anchor smooth handles: Catmull-Rom tangent from its
// neighbors, the same curve the old "Smooth curves" toggle drew.
function smoothNode(nodes: PathNode[], i: number): PathNode {
  const n = nodes.length;
  const p0 = nodes[(i - 1 + n) % n];
  const p1 = nodes[i];
  const p2 = nodes[(i + 1) % n];
  const tx = (p2.x - p0.x) / 6, ty = (p2.y - p0.y) / 6;
  return { ...p1, h1: { x: p1.x - tx, y: p1.y - ty }, h2: { x: p1.x + tx, y: p1.y + ty }, smooth: true };
}

const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Point on segment i -> i+1 at parameter t (line or cubic).
function segmentPoint(a: PathNode, b: PathNode, t: number): { x: number; y: number } {
  if (!a.h2 && !b.h1) return lerp(a, b, t);
  const c1 = a.h2 ?? { x: a.x, y: a.y };
  const c2 = b.h1 ?? { x: b.x, y: b.y };
  const p01 = lerp(a, c1, t), p12 = lerp(c1, c2, t), p23 = lerp(c2, b, t);
  const p012 = lerp(p01, p12, t), p123 = lerp(p12, p23, t);
  return lerp(p012, p123, t);
}

type DragTarget = { kind: 'anchor' | 'h1' | 'h2'; index: number } | null;

export function PenEditor() {
  const penEditor = useUiStore((s) => s.penEditor);
  const close = useUiStore((s) => s.closePenEditor);
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const block = useProjectStore((s) =>
    penEditor
      ? s.project.slides.flatMap((sl) => sl.layers.flatMap((l) => walkBlocks(l.blocks))).find((b) => b.id === penEditor.blockId)
      : undefined
  );

  const [nodes, setNodes] = useState<PathNode[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [freehand, setFreehand] = useState(false);
  const [stroke, setStroke] = useState<{ x: number; y: number }[] | null>(null);
  const [sides, setSides] = useState(5);
  const [message, setMessage] = useState('');
  const dragRef = useRef<DragTarget>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Undo / redo. nodesRef mirrors state so history can be pushed outside React
  // updaters; drags snapshot once at pointer-down, not per move.
  const nodesRef = useRef<PathNode[]>([]);
  const past = useRef<PathNode[][]>([]);
  const future = useRef<PathNode[][]>([]);
  const edit = (fn: (ns: PathNode[]) => PathNode[], record = true) => {
    const next = fn(nodesRef.current);
    if (record) { past.current.push(nodesRef.current); if (past.current.length > 100) past.current.shift(); future.current = []; }
    nodesRef.current = next;
    setNodes(next);
  };
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(nodesRef.current);
    nodesRef.current = prev; setNodes(prev); setSel(null);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(nodesRef.current);
    nodesRef.current = next; setNodes(next); setSel(null);
  };

  // Seed when the target changes.
  useEffect(() => {
    if (penEditor && block) {
      const seeded = seedNodes(penEditor.mode, block.props as ShapeProps | ImageProps);
      nodesRef.current = seeded; setNodes(seeded);
    }
    past.current = []; future.current = [];
    setSel(null); setFreehand(false); setStroke(null); setMessage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penEditor?.blockId, penEditor?.mode]);

  useEffect(() => {
    if (!penEditor) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      // Capture phase, and stop the event: the editor's own Ctrl+Z and Delete
      // would otherwise undo or delete the block this dialog is editing.
      const mod = e.ctrlKey || e.metaKey;
      const own = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (mod && e.key.toLowerCase() === 'z') { own(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { own(); redo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel !== null) {
        own();
        edit((ns) => ns.filter((_, i) => i !== sel)); setSel(null);
      } else if (e.key === 'Escape') { own(); close(); }
      else if (sel !== null && e.key.startsWith('Arrow')) {
        own();
        const step = e.shiftKey ? 5 : 0.5;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        edit((ns) => ns.map((n, i) => i !== sel ? n : {
          ...n, x: n.x + dx, y: n.y + dy,
          h1: n.h1 ? { x: n.h1.x + dx, y: n.h1.y + dy } : undefined,
          h2: n.h2 ? { x: n.h2.x + dx, y: n.h2.y + dy } : undefined
        }));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penEditor, sel, close]);

  if (!penEditor || !block) return null;

  const toLocal = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  // Click on the outline inserts an anchor mid-segment; click on empty
  // space appends one at the end of the path.
  const onCanvasClick = (e: React.MouseEvent) => {
    const cls = (e.target as Element).classList;
    if (freehand || cls.contains('pen-node') || cls.contains('pen-handle')) return;
    const p = toLocal(e);
    if (nodes.length >= 2) {
      const hit = nearestOnPath(nodes, p, 3.5);
      if (hit) {
        edit((ns) => insertOnSegment(ns, hit.seg, hit.t));
        setSel(hit.seg + 1);
        return;
      }
    }
    edit((ns) => [...ns, p]);
    setSel(nodes.length);
  };

  const startDrag = (t: NonNullable<DragTarget>, e: React.PointerEvent) => {
    e.stopPropagation();
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* stale pointer */ }
    dragRef.current = t;
    // One undo step per drag.
    past.current.push(nodesRef.current); future.current = [];
    setSel(t.index);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toLocal(e);
    edit((ns) =>
      ns.map((node, i) => {
        if (i !== d.index) return node;
        if (d.kind === 'anchor') {
          const dx = p.x - node.x, dy = p.y - node.y;
          return {
            ...node,
            x: p.x, y: p.y,
            h1: node.h1 ? { x: node.h1.x + dx, y: node.h1.y + dy } : undefined,
            h2: node.h2 ? { x: node.h2.x + dx, y: node.h2.y + dy } : undefined
          };
        }
        const next = { ...node, [d.kind]: p } as PathNode;
        if (node.smooth) {
          // Mirror the opposite handle through the anchor.
          const other = d.kind === 'h1' ? 'h2' : 'h1';
          next[other] = { x: 2 * node.x - p.x, y: 2 * node.y - p.y };
        }
        return next;
      })
    , false);
  };
  const onMoveAll = (e: React.PointerEvent) => {
    if (stroke) { const p = toLocal(e); setStroke((st) => (st ? [...st, p] : st)); return; }
    onMove(e);
  };
  const onDown = (e: React.PointerEvent) => {
    if (!freehand) return;
    const cls = (e.target as Element).classList;
    if (cls.contains('pen-node') || cls.contains('pen-handle')) return;
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* stale pointer */ }
    setStroke([toLocal(e)]);
  };
  const onUp = () => {
    dragRef.current = null;
    if (stroke) {
      const drawn = freehandToNodes(stroke, 0.9);
      setStroke(null);
      if (drawn) { edit(() => drawn); setSel(null); setMessage('Drawn as a smooth outline. Drag points to refine, or switch to Corner to sharpen one.'); }
    }
  };

  const removeNode = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    edit((ns) => ns.filter((_, idx) => idx !== i));
    setSel(null);
  };

  const convertSel = (to: 'smooth' | 'corner' | 'straight') => {
    if (sel === null) return;
    edit((ns) =>
      ns.map((node, i) => {
        if (i !== sel) return node;
        if (to === 'smooth') return node.h1 || node.h2 ? { ...node, smooth: true } : smoothNode(ns, i);
        if (to === 'corner') return { ...node, smooth: undefined };
        return { x: node.x, y: node.y }; // straight: drop the handles
      })
    );
  };

  const importSvg = async (file: File) => {
    try {
      const svg = parseSvgText(await file.text());
      const outline = largestOutline(svg, block.w, block.h);
      edit(() => outline); setSel(null);
      const extra = svg.shapes.filter((x) => x.nodes.length >= 3).length - 1;
      setMessage(
        `SVG imported as one outline.` +
        (extra > 0 ? ` The file has ${extra} more shape${extra === 1 ? '' : 's'}; a custom shape holds one path, so only the largest came in. Use Insert > SVG to bring the whole drawing in.` : '')
      );
    } catch (err) {
      setMessage((err as Error).message || 'Could not read that SVG.');
    }
  };
  // Regular shapes look regular even when the block isn't square.
  const radii = () => {
    const m = Math.min(block.w, block.h);
    return { rx: 50 * (m / block.w), ry: 50 * (m / block.h) };
  };
  const generate = (kind: 'polygon' | 'star') => {
    const { rx, ry } = radii();
    edit(() => (kind === 'polygon' ? polygonNodes(sides, rx, ry) : starNodes(sides, 0.45, rx, ry)));
    setSel(null); setMessage('');
  };

  const apply = () => {
    updateBlock(penEditor.blockId, (b) => {
      if (penEditor.mode === 'imageClip') {
        const ip = b.props as ImageProps;
        ip.clipNodes = nodes.length >= 3 ? nodes : undefined;
        ip.clipPoints = undefined;
        if (ip.clipNodes) ip.clipKind = undefined;
        return;
      }
      const sp = b.props as ShapeProps;
      sp.points = undefined;
      sp.smooth = undefined;
      if (nodes.length < 3) {
        sp.nodes = undefined;
        return;
      }
      // Trim to content: normalize the drawing (handles included) to its
      // bounding box and resize the block by the same fraction, so the
      // shape stays exactly where it was drawn with no dead margin.
      const xs = nodes.flatMap((n) => [n.x, n.h1?.x, n.h2?.x]).filter((v): v is number => v !== undefined);
      const ys = nodes.flatMap((n) => [n.y, n.h1?.y, n.h2?.y]).filter((v): v is number => v !== undefined);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = maxX - minX, bh = maxY - minY;
      if (bw > 1 && bh > 1 && (minX > 0.5 || minY > 0.5 || maxX < 99.5 || maxY < 99.5)) {
        const nx = (v: number) => ((v - minX) / bw) * 100;
        const ny = (v: number) => ((v - minY) / bh) * 100;
        sp.nodes = nodes.map((n) => ({
          ...n,
          x: nx(n.x), y: ny(n.y),
          h1: n.h1 ? { x: nx(n.h1.x), y: ny(n.h1.y) } : undefined,
          h2: n.h2 ? { x: nx(n.h2.x), y: ny(n.h2.y) } : undefined
        }));
        b.x = Math.round(b.x + (minX / 100) * b.w);
        b.y = Math.round(b.y + (minY / 100) * b.h);
        b.w = Math.max(20, Math.round((bw / 100) * b.w));
        b.h = Math.max(20, Math.round((bh / 100) * b.h));
      } else {
        sp.nodes = nodes;
      }
    });
    close();
  };

  const imgProps = penEditor.mode === 'imageClip' ? (block.props as ImageProps) : null;
  const imgSrc = imgProps?.src ?? null;
  const selNode = sel !== null ? nodes[sel] : null;
  const d = nodes.length >= 2 ? pathFromNodes(nodes, nodes.length >= 3) : '';
  const { w: EW, h: EH } = editSize(block.w, block.h);
  const toSvgX = (v: number) => (v / 100) * EW;
  const toSvgY = (v: number) => (v / 100) * EH;

  return (
    <div className="pen-overlay" onClick={close}>
      <div className="pen-dialog" role="dialog" aria-modal="true" aria-label="Pen tool" onClick={(e) => e.stopPropagation()}>
        <div className="cs-head">
          <div className="cs-head-text">
            <h2>{penEditor.mode === 'imageClip' ? 'Custom image clip' : 'Custom shape'}</h2>
            <p>Click to add points, drag to move them. Click the outline to insert a point.</p>
          </div>
          <button type="button" className="cs-icon-btn" aria-label="Close" title="Close" onClick={close}><Lucide name="x" size={18} /></button>
        </div>
        <div className="pen-main">
          <div className="pen-stage">
        <svg
          ref={svgRef}
          className="pen-canvas"
          width={EW}
          height={EH}
          viewBox={`0 0 ${EW} ${EH}`}
          onClick={onCanvasClick}
          onPointerDown={onDown}
          onPointerMove={onMoveAll}
          onPointerUp={onUp}
          style={freehand ? { cursor: 'crosshair', touchAction: 'none' } : undefined}
        >
          {imgSrc && (
            <image
              href={imgSrc}
              x="0" y="0" width={EW} height={EH}
              // Match how the block actually displays the image, so tracing
              // is accurate: contain letterboxes, cover crops.
              preserveAspectRatio={imgProps?.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
              opacity="0.55"
            />
          )}
          <rect x="0" y="0" width={EW} height={EH} fill="none" stroke="#3b463f" />
          {d && (
            <g transform={`scale(${EW / 100} ${EH / 100})`}>
              <path
                d={d}
                fill={nodes.length >= 3 ? 'rgba(var(--accent-rgb), 0.1)' : 'none'}
                style={{ stroke: 'var(--accent)', fill: nodes.length >= 3 ? 'rgba(var(--accent-rgb), 0.1)' : 'none' }}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
          {stroke && stroke.length > 1 && (
            <polyline
              points={stroke.map((q) => `${toSvgX(q.x)},${toSvgY(q.y)}`).join(' ')}
              fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              style={{ stroke: 'var(--accent)' }}
            />
          )}
          {/* Handles of the selected anchor */}
          {selNode && (['h1', 'h2'] as const).map((hk) => {
            const hpos = selNode[hk];
            if (!hpos) return null;
            return (
              <g key={hk}>
                <line
                  x1={toSvgX(selNode.x)} y1={toSvgY(selNode.y)}
                  x2={toSvgX(hpos.x)} y2={toSvgY(hpos.y)}
                  stroke="#7aa2ff" strokeWidth={1}
                />
                <rect
                  className="pen-handle"
                  x={toSvgX(hpos.x) - 5} y={toSvgY(hpos.y) - 5}
                  width={10} height={10}
                  onPointerDown={(e) => startDrag({ kind: hk, index: sel! }, e)}
                />
              </g>
            );
          })}
          {nodes.map((n, i) => (
            <circle
              key={i}
              className={`pen-node ${i === sel ? 'active' : ''} ${n.smooth ? 'smooth' : ''}`}
              cx={toSvgX(n.x)}
              cy={toSvgY(n.y)}
              r={7}
              onPointerDown={(e) => startDrag({ kind: 'anchor', index: i }, e)}
              onDoubleClick={(e) => removeNode(i, e)}
            />
          ))}
        </svg>
          </div>
          <aside className="pen-side">
            <section>
              <h3 className="cs-label">Draw</h3>
              <button
                className={`btn btn-ghost${freehand ? ' active' : ''}`}
                aria-pressed={freehand}
                title="Draw freehand: drag on the canvas and release; the stroke is simplified and smoothed"
                onClick={() => setFreehand((v) => !v)}
              >
                Freehand
              </button>
              <label className="pen-sides">
                <span>Sides</span>
                <input
                  type="number" min={3} max={24} value={sides}
                  onChange={(e) => setSides(Math.max(3, Math.min(24, Math.round(Number(e.target.value) || 5))))}
                  className="input input-number"
                  aria-label="Number of sides or points"
                />
              </label>
              <div className="pen-row">
                <button className="btn btn-ghost" onClick={() => generate('polygon')} title="Replace the path with a regular polygon">Polygon</button>
                <button className="btn btn-ghost" onClick={() => generate('star')} title="Replace the path with a star">Star</button>
              </div>
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} title="Replace the path with the largest outline in an SVG file">Import SVG</button>
              <input
                ref={fileRef} type="file" accept=".svg,image/svg+xml" hidden aria-label="Import an SVG outline"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importSvg(f); }}
              />
            </section>
            <section>
              <h3 className="cs-label">Points · <span className="pen-count">{nodes.length} points</span></h3>
              {/* Always present, disabled until a point is selected, so the dialog never resizes. */}
              <div className="pen-row pen-node-tools">
                <button className="btn btn-ghost" title="Smooth point (mirrored handles)" disabled={!selNode} onClick={() => convertSel('smooth')}>Smooth</button>
                <button className="btn btn-ghost" title="Corner point (independent handles)" onClick={() => convertSel('corner')} disabled={!selNode || (!selNode.h1 && !selNode.h2)}>Corner</button>
              </div>
              <div className="pen-row">
                <button className="btn btn-ghost" title="Remove this point's handles" onClick={() => convertSel('straight')} disabled={!selNode || (!selNode.h1 && !selNode.h2)}>Straight</button>
                <button className="btn btn-ghost btn-danger" title="Delete this point (Del)" disabled={!selNode} onClick={(e) => removeNode(sel!, e)}>Delete</button>
              </div>
              <button
                className="btn btn-ghost"
                title="Give every point smooth curve handles"
                disabled={nodes.length < 3}
                onClick={() => edit((ns) => ns.map((_, i) => smoothNode(ns, i)))}
              >
                Smooth all
              </button>
            </section>
            <section>
              <h3 className="cs-label">History</h3>
              <div className="pen-row">
                <button className="btn btn-ghost" disabled={!past.current.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
                <button className="btn btn-ghost" disabled={!future.current.length} onClick={redo} title="Redo (Ctrl+Shift+Z)">Redo</button>
              </div>
              <button className="btn btn-ghost" onClick={() => { edit(() => []); setSel(null); }}>Clear</button>
            </section>
            {message && <p className="pen-message" role="status">{message}</p>}
          </aside>
        </div>
        <div className="cs-foot">
          <span>Arrows nudge a point · Del removes it · Ctrl+Z undoes</span>
          <span className="pen-foot-actions">
            <button className="btn" onClick={close}>Cancel</button>
            <button className="btn btn-accent" onClick={apply} disabled={nodes.length > 0 && nodes.length < 3}>
              {nodes.length === 0 ? (penEditor.mode === 'imageClip' ? 'Remove custom clip' : 'Remove custom shape') : 'Apply'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

// Closest point on the path outline within `threshold` (0..100 units).
function nearestOnPath(nodes: PathNode[], p: { x: number; y: number }, threshold: number):
  { seg: number; t: number } | null {
  const n = nodes.length;
  const segs = n >= 3 ? n : n - 1; // closed once it's a real polygon
  let best: { seg: number; t: number; d: number } | null = null;
  for (let s = 0; s < segs; s++) {
    const a = nodes[s], b = nodes[(s + 1) % n];
    for (let k = 1; k < 24; k++) {
      const t = k / 24;
      const q = segmentPoint(a, b, t);
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      if (dist < threshold && (!best || dist < best.d)) best = { seg: s, t, d: dist };
    }
  }
  return best && { seg: best.seg, t: best.t };
}

// Split segment `seg` at parameter t, preserving the curve exactly
// (de Casteljau for cubics, plain interpolation for lines).
function insertOnSegment(nodes: PathNode[], seg: number, t: number): PathNode[] {
  const n = nodes.length;
  const a = nodes[seg], b = nodes[(seg + 1) % n];
  const out = nodes.map((x) => ({ ...x }));
  let mid: PathNode;
  if (!a.h2 && !b.h1) {
    mid = lerp(a, b, t);
  } else {
    const c1 = a.h2 ?? { x: a.x, y: a.y };
    const c2 = b.h1 ?? { x: b.x, y: b.y };
    const p01 = lerp(a, c1, t), p12 = lerp(c1, c2, t), p23 = lerp(c2, b, t);
    const p012 = lerp(p01, p12, t), p123 = lerp(p12, p23, t);
    const f = lerp(p012, p123, t);
    out[seg].h2 = p01;
    out[(seg + 1) % n].h1 = p23;
    mid = { ...f, h1: p012, h2: p123, smooth: true };
  }
  out.splice(seg + 1, 0, mid);
  return out;
}
