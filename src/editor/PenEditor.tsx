import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import type { ImageProps, ShapeProps } from '../schema/types';

// A pen / node editor for custom shapes and image clip masks. Click on the
// canvas to drop points; drag a node to move it; double-click a node to
// remove it. Points live in a 0..100 space (stretched to the block, the same
// model as our preset geometry), so the drawn path scales with the block.
// For image clips the current image shows underneath so you can trace it.

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
    penEditor ? s.project.slides.flatMap((sl) => sl.layers.flatMap((l) => l.blocks)).find((b) => b.id === penEditor.blockId) : undefined
  );

  const initial = (() => {
    if (!penEditor || !block) return [];
    if (penEditor.mode === 'imageClip') return parsePoints((block.props as ImageProps).clipPoints);
    return parsePoints((block.props as ShapeProps).points);
  })();

  const [points, setPoints] = useState<[number, number][]>(initial);
  const [drag, setDrag] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Reset when the target changes.
  useEffect(() => { setPoints(initial); /* eslint-disable-next-line */ }, [penEditor?.blockId]);

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
    const str = points.length >= 3 ? serialize(points) : undefined;
    updateBlock(penEditor.blockId, (b) => {
      if (penEditor.mode === 'imageClip') {
        const ip = b.props as ImageProps;
        ip.clipPoints = str;
        if (str) ip.clipKind = undefined;
      } else {
        (b.props as ShapeProps).points = str;
      }
    });
    close();
  };

  const imgSrc = penEditor.mode === 'imageClip' ? (block.props as ImageProps).src : null;
  const polyPoints = points.map(([x, y]) => `${(x / 100) * SIZE},${(y / 100) * SIZE}`).join(' ');

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
            <polygon points={polyPoints} fill="rgba(61,220,151,0.25)" stroke="#3ddc97" strokeWidth={1.5} />
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
