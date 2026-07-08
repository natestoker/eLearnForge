import type { MotionPath } from '../schema/types';

// Motion paths move a block along a curve over the slide timeline. Stored
// compactly as a preset plus a single control vector (the draggable handle);
// the polyline is generated on demand so it stays scrub-friendly and small
// in the project JSON.

// Generate the path as a polyline of px offsets from the block's authored
// position. points[0] is always {0,0} (the block starts where it is).
export function motionPoints(m: MotionPath): { x: number; y: number }[] {
  const { x, y } = m.vector;
  if (m.preset === 'line') return [{ x: 0, y: 0 }, { x, y }];

  if (m.preset === 'arc') {
    // Quadratic bezier from origin to the handle, bowed out perpendicular
    // to the chord so it reads as an arc.
    const mx = x / 2, my = y / 2;
    const len = Math.hypot(x, y) || 1;
    const px = -y / len, py = x / len; // unit perpendicular
    const bow = len * 0.4;
    const cx = mx + px * bow, cy = my + py * bow;
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const ix = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * cx + t * t * x;
      const iy = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * cy + t * t * y;
      out.push({ x: ix, y: iy });
    }
    return out;
  }

  // circle: the handle marks the far side; center is the midpoint, radius
  // half the handle distance. Travels a full loop back to the start.
  const cx = x / 2, cy = y / 2;
  const r = Math.hypot(cx, cy) || 1;
  const a0 = Math.atan2(0 - cy, 0 - cx); // angle of the start point (origin)
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= 32; i++) {
    const a = a0 + (2 * Math.PI * i) / 32;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

// Point at arc-length fraction f (0..1) along the polyline.
function pointAtFraction(pts: { x: number; y: number }[], f: number): { x: number; y: number } {
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 };
  const segLen: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segLen.push(d);
    total += d;
  }
  if (total === 0) return pts[0];
  let target = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < segLen.length; i++) {
    if (target <= segLen[i] || i === segLen.length - 1) {
      const t = segLen[i] === 0 ? 0 : target / segLen[i];
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t
      };
    }
    target -= segLen[i];
  }
  return pts[pts.length - 1];
}

// The block's motion offset at time t (px). Before start = origin; after the
// end = the last point (unless looping). `ease` is applied by the caller.
export function motionOffsetAt(m: MotionPath, t: number, easedProgress: (p: number) => number): { x: number; y: number } {
  if (t < m.start) return { x: 0, y: 0 };
  let p = m.duration > 0 ? (t - m.start) / m.duration : 1;
  if (m.loop) p = p - Math.floor(p);
  else p = Math.min(1, p);
  return pointAtFraction(motionPoints(m), easedProgress(m.loop ? p : p));
}
