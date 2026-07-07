import { useState, useRef, useEffect } from 'react';
import { useProjectStore, walkBlocks } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import type { ImageProps, PathNode, ShapeProps } from '../schema/types';
import {
  SHAPE_POINTS, SHAPE_PATHS, nodesFromPoints, nodesFromPresetPath, pathFromNodes
} from '../blocks/shape/geometry';

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
  const dragRef = useRef<DragTarget>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Seed when the target changes.
  useEffect(() => {
    if (penEditor && block) setNodes(seedNodes(penEditor.mode, block.props as ShapeProps | ImageProps));
    setSel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penEditor?.blockId, penEditor?.mode]);

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
    if (cls.contains('pen-node') || cls.contains('pen-handle')) return;
    const p = toLocal(e);
    if (nodes.length >= 2) {
      const hit = nearestOnPath(nodes, p, 3.5);
      if (hit) {
        setNodes((ns) => insertOnSegment(ns, hit.seg, hit.t));
        setSel(hit.seg + 1);
        return;
      }
    }
    setNodes((ns) => [...ns, p]);
    setSel(nodes.length);
  };

  const startDrag = (t: NonNullable<DragTarget>, e: React.PointerEvent) => {
    e.stopPropagation();
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* stale pointer */ }
    dragRef.current = t;
    setSel(t.index);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toLocal(e);
    setNodes((ns) =>
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
    );
  };
  const onUp = () => { dragRef.current = null; };

  const removeNode = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((ns) => ns.filter((_, idx) => idx !== i));
    setSel(null);
  };

  const convertSel = (to: 'smooth' | 'corner' | 'straight') => {
    if (sel === null) return;
    setNodes((ns) =>
      ns.map((node, i) => {
        if (i !== sel) return node;
        if (to === 'smooth') return node.h1 || node.h2 ? { ...node, smooth: true } : smoothNode(ns, i);
        if (to === 'corner') return { ...node, smooth: undefined };
        return { x: node.x, y: node.y }; // straight: drop the handles
      })
    );
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
      <div className="pen-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pen-head">
          <span>Pen tool - {penEditor.mode === 'imageClip' ? 'custom image clip' : 'custom shape'}</span>
          <span className="pen-hint">
            Click to add points (on the outline inserts mid-segment). Drag points and handles.
            Double-click a point to remove it.
          </span>
        </div>
        <svg
          ref={svgRef}
          className="pen-canvas"
          width={EW}
          height={EH}
          viewBox={`0 0 ${EW} ${EH}`}
          onClick={onCanvasClick}
          onPointerMove={onMove}
          onPointerUp={onUp}
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
          <rect x="0" y="0" width={EW} height={EH} fill="none" stroke="#2c3648" />
          {d && (
            <g transform={`scale(${EW / 100} ${EH / 100})`}>
              <path
                d={d}
                fill={nodes.length >= 3 ? 'rgba(61,220,151,0.25)' : 'none'}
                stroke="#3ddc97"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </g>
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
        <div className="pen-actions">
          <button className="btn btn-ghost" onClick={() => { setNodes([]); setSel(null); }}>Clear</button>
          <button
            className="btn btn-ghost"
            title="Give every point smooth curve handles"
            disabled={nodes.length < 3}
            onClick={() => setNodes((ns) => ns.map((_, i) => smoothNode(ns, i)))}
          >
            Smooth all
          </button>
          <span className="pen-count">{nodes.length} points</span>
          <div className="pen-spacer" />
          {selNode && (
            <span className="pen-node-tools">
              <button className="btn btn-ghost" title="Smooth point (mirrored handles)" onClick={() => convertSel('smooth')}>Smooth</button>
              <button className="btn btn-ghost" title="Corner point (independent handles)" onClick={() => convertSel('corner')} disabled={!selNode.h1 && !selNode.h2}>Corner</button>
              <button className="btn btn-ghost" title="Remove this point's handles" onClick={() => convertSel('straight')} disabled={!selNode.h1 && !selNode.h2}>Straight</button>
              <button className="btn btn-ghost btn-danger" title="Delete this point" onClick={(e) => removeNode(sel!, e)}>Delete</button>
            </span>
          )}
          <button className="btn" onClick={close}>Cancel</button>
          <button className="btn btn-accent" onClick={apply} disabled={nodes.length > 0 && nodes.length < 3}>
            {nodes.length === 0 ? (penEditor.mode === 'imageClip' ? 'Remove custom clip' : 'Remove custom shape') : 'Apply'}
          </button>
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
