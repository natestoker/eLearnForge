import { useState, useRef, useEffect } from 'react';
import { useProjectStore, walkBlocks } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import type { ImageProps, ShapeProps } from '../schema/types';
import { SHAPE_POINTS, smoothPathFromPoints } from '../blocks/shape/geometry';

// A pen / node editor for custom shapes and image clip masks. Click on the
// canvas to drop points; drag a node to move it; double-click a node to
// remove it. Points live in a 0..100 space (stretched to the block, the same
// model as our preset geometry), so the drawn path scales with the block.
// For image clips the current image shows underneath so you can trace it.
// Editing a preset shape starts from that preset's points (right-click a
// shape on the canvas to get here directly). "Smooth" renders the nodes as
// a closed curve instead of straight segments. On apply, the drawing is
// trimmed to its content: the points are normalized to their bounding box
// and the block is resized to match, so no dead margin is kept.

const SIZE = 480; // editor canvas is square; maps 0..100 -> 0..SIZE

function parsePoints(str: string | undefined): [number, number][] {
  if (!str) return [];
  return str.trim().split(/\s+/).map((p) => {
    const [x, y] = p.split(',').map(Number);
    return [x, y] as [number, number];
  });
}
function serialize(points: [number, number][]): string {
  return points.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');
}

export function PenEditor() {
  const penEditor = useUiStore((s) => s.penEditor);
  const close = useUiStore((s) => s.closePenEditor);
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const block = useProjectStore((s) =>
    penEditor
      ? s.project.slides.flatMap((sl) => sl.layers.flatMap((l) => walkBlocks(l.blocks))).find((b) => b.id === penEditor.blockId)
      : undefined
  );

  const initial = (): [number, number][] => {
    if (!penEditor || !block) return [];
    if (penEditor.mode === 'imageClip') return parsePoints((block.props as ImageProps).clipPoints);
    const sp = block.props as ShapeProps;
    if (sp.points) return parsePoints(sp.points);
    // Editing a preset: seed with its geometry so "update the shape" starts
    // from what's on the canvas. Rect kinds seed as a square; path-based
    // presets (hearts, clouds...) have no polygon to seed and start blank.
    if (sp.kind === 'rectangle' || sp.kind === 'roundedRectangle') {
      return [[0, 0], [100, 0], [100, 100], [0, 100]];
    }
    return parsePoints(SHAPE_POINTS[sp.kind]);
  };

  const [points, setPoints] = useState<[number, number][]>(initial);
  const [smooth, setSmooth] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Reset when the target changes.
  useEffect(() => {
    setPoints(initial());
    setSmooth(penEditor?.mode === 'shape' ? Boolean((block?.props as ShapeProps | undefined)?.smooth) : false);
    // eslint-disable-next-line
  }, [penEditor?.blockId]);

  if (!penEditor || !block) return null;

  const toLocal = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    return [Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y))];
  };

  const addPoint = (e: React.MouseEvent) => {
    if (drag !== null) return;
    if ((e.target as Element).classList.contains('pen-node')) return;
    setPoints((p) => [...p, toLocal(e)]);
  };

  const onNodeDown = (i: number, e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag(i);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag === null) return;
    const pt = toLocal(e);
    setPoints((p) => p.map((old, i) => (i === drag ? pt : old)));
  };
  const onUp = () => setDrag(null);

  const removeNode = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPoints((p) => p.filter((_, idx) => idx !== i));
  };

  const apply = () => {
    updateBlock(penEditor.blockId, (b) => {
      if (penEditor.mode === 'imageClip') {
        const ip = b.props as ImageProps;
        ip.clipPoints = points.length >= 3 ? serialize(points) : undefined;
        if (ip.clipPoints) ip.clipKind = undefined;
        return;
      }
      const sp = b.props as ShapeProps;
      if (points.length < 3) {
        sp.points = undefined;
        sp.smooth = undefined;
        return;
      }
      // Trim to content: normalize the drawing to its bounding box and
      // resize the block by the same fraction, so the shape stays exactly
      // where it was drawn but the block carries no unused margin.
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = maxX - minX, bh = maxY - minY;
      if (bw > 1 && bh > 1) {
        sp.points = serialize(points.map(([x, y]) => [((x - minX) / bw) * 100, ((y - minY) / bh) * 100]));
        b.x = Math.round(b.x + (minX / 100) * b.w);
        b.y = Math.round(b.y + (minY / 100) * b.h);
        b.w = Math.max(20, Math.round((bw / 100) * b.w));
        b.h = Math.max(20, Math.round((bh / 100) * b.h));
      } else {
        sp.points = serialize(points);
      }
      sp.smooth = smooth || undefined;
    });
    close();
  };

  const imgSrc = penEditor.mode === 'imageClip' ? (block.props as ImageProps).src : null;
  const polyPoints = points.map(([x, y]) => `${(x / 100) * SIZE},${(y / 100) * SIZE}`).join(' ');
  const showSmooth = penEditor.mode === 'shape';

  return (
    <div className="pen-overlay" onClick={close}>
      <div className="pen-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pen-head">
          <span>Pen tool - {penEditor.mode === 'imageClip' ? 'custom image clip' : 'custom shape'}</span>
          <span className="pen-hint">Click to add points, drag nodes to move, double-click a node to remove.</span>
        </div>
        <svg
          ref={svgRef}
          className="pen-canvas"
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          onClick={addPoint}
          onPointerMove={onMove}
          onPointerUp={onUp}
        >
          {imgSrc && <image href={imgSrc} x="0" y="0" width={SIZE} height={SIZE} preserveAspectRatio="none" opacity="0.55" />}
          <rect x="0" y="0" width={SIZE} height={SIZE} fill="none" stroke="#2c3648" />
          {points.length >= 2 && (
            smooth && points.length >= 3 ? (
              <g transform={`scale(${SIZE / 100})`}>
                <path
                  d={smoothPathFromPoints(serialize(points))}
                  fill="rgba(61,220,151,0.25)"
                  stroke="#3ddc97"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ) : (
              <polygon points={polyPoints} fill="rgba(61,220,151,0.25)" stroke="#3ddc97" strokeWidth={1.5} />
            )
          )}
          {points.map(([x, y], i) => (
            <circle
              key={i}
              className="pen-node"
              cx={(x / 100) * SIZE}
              cy={(y / 100) * SIZE}
              r={7}
              onPointerDown={(e) => onNodeDown(i, e)}
              onDoubleClick={(e) => removeNode(i, e)}
            />
          ))}
        </svg>
        <div className="pen-actions">
          <button className="btn btn-ghost" onClick={() => setPoints([])}>Clear</button>
          {showSmooth && (
            <label className="checkbox" title="Draw a smooth closed curve through the nodes">
              <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />
              <span>Smooth curves</span>
            </label>
          )}
          <span className="pen-count">{points.length} points</span>
          <div className="pen-spacer" />
          <button className="btn" onClick={close}>Cancel</button>
          <button className="btn btn-accent" onClick={apply} disabled={points.length > 0 && points.length < 3}>
            {points.length === 0 ? 'Remove custom shape' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
