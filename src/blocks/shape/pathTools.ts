import type { PathNode } from '../../schema/types';

// Pure helpers behind the custom shape tool: SVG path parsing, freehand
// simplification, and polygon / star generators. No DOM, so they are unit
// tested in Node (tests/path-tools.test.ts). The SVG document walker that
// needs DOMParser lives in svgImport.ts.

type Pt = { x: number; y: number };

export interface Subpath { nodes: PathNode[]; closed: boolean }

// ---------------------------------------------------------------- path data

class Scanner {
  private i = 0;
  constructor(private s: string) {}
  private skip() { while (this.i < this.s.length && /[\s,]/.test(this.s[this.i])) this.i++; }
  atCommand(): string | null {
    this.skip();
    const c = this.s[this.i];
    return c && /[A-Za-z]/.test(c) ? c : null;
  }
  next(): string { this.skip(); return this.s[this.i++]; }
  done(): boolean { this.skip(); return this.i >= this.s.length; }
  hasNumber(): boolean {
    this.skip();
    return this.i < this.s.length && /[-+.\d]/.test(this.s[this.i]);
  }
  number(): number {
    this.skip();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(this.s.slice(this.i));
    if (!m) throw new Error('bad number in path data');
    this.i += m[0].length;
    return parseFloat(m[0]);
  }
  // Arc flags are single characters and may be packed ("a1 1 0 011 1").
  flag(): number {
    this.skip();
    const c = this.s[this.i++];
    if (c !== '0' && c !== '1') throw new Error('bad arc flag');
    return c === '1' ? 1 : 0;
  }
}

// SVG endpoint arc -> cubic Beziers (W3C implementation notes, F.6).
export function arcToCubics(
  x1: number, y1: number, rx: number, ry: number, phiDeg: number,
  large: number, sweep: number, x2: number, y2: number
): Array<{ c1: Pt; c2: Pt; p: Pt }> {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [{ c1: { x: x1, y: y1 }, c2: { x: x2, y: y2 }, p: { x: x2, y: y2 } }];
  const phi = (phiDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  else if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
  const step = dt / n, k = (4 / 3) * Math.tan(step / 4);
  const out: Array<{ c1: Pt; c2: Pt; p: Pt }> = [];
  const pt = (a: number): Pt => ({
    x: cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin,
    y: cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos
  });
  const dv = (a: number): Pt => ({
    x: -rx * Math.sin(a) * cos - ry * Math.cos(a) * sin,
    y: -rx * Math.sin(a) * sin + ry * Math.cos(a) * cos
  });
  for (let i = 0; i < n; i++) {
    const a0 = t1 + i * step, a1 = a0 + step;
    const p0 = pt(a0), p3 = pt(a1), d0 = dv(a0), d1 = dv(a1);
    out.push({
      c1: { x: p0.x + k * d0.x, y: p0.y + k * d0.y },
      c2: { x: p3.x - k * d1.x, y: p3.y - k * d1.y },
      p: i === n - 1 ? { x: x2, y: y2 } : p3
    });
  }
  return out;
}

// SVG path data -> one subpath per M. Curves become anchors with Bezier
// handles (quadratics are raised to cubics, arcs split into cubics).
export function parsePathData(d: string): Subpath[] {
  const sc = new Scanner(d);
  const subs: Subpath[] = [];
  let nodes: PathNode[] = [];
  let closed = false;
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let cmd = '';
  let lastC2 = null as Pt | null, lastQ = null as Pt | null;
  const flush = () => { if (nodes.length) subs.push({ nodes, closed }); nodes = []; closed = false; };
  const cubic = (c1: Pt, c2: Pt, p: Pt) => {
    const last = nodes[nodes.length - 1];
    if (last) last.h2 = { ...c1 };
    nodes.push({ x: p.x, y: p.y, h1: { ...c2 } });
    cx = p.x; cy = p.y; lastC2 = c2; lastQ = null;
  };
  while (!sc.done()) {
    const c = sc.atCommand();
    if (c) { cmd = sc.next(); } else if (!cmd || /[Zz]/.test(cmd)) { throw new Error('bad path data'); }
    else if (cmd === 'M') cmd = 'L'; else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? cx : 0, oy = rel ? cy : 0;
    switch (cmd.toUpperCase()) {
      case 'M': {
        flush();
        cx = ox + sc.number(); cy = oy + sc.number(); sx = cx; sy = cy;
        nodes = [{ x: cx, y: cy }]; lastC2 = null; lastQ = null;
        break;
      }
      case 'L': { cx = ox + sc.number(); cy = oy + sc.number(); nodes.push({ x: cx, y: cy }); lastC2 = null; lastQ = null; break; }
      case 'H': { cx = (rel ? cx : 0) + sc.number(); nodes.push({ x: cx, y: cy }); lastC2 = null; lastQ = null; break; }
      case 'V': { cy = (rel ? cy : 0) + sc.number(); nodes.push({ x: cx, y: cy }); lastC2 = null; lastQ = null; break; }
      case 'C': {
        const c1 = { x: ox + sc.number(), y: oy + sc.number() };
        const c2 = { x: ox + sc.number(), y: oy + sc.number() };
        cubic(c1, c2, { x: ox + sc.number(), y: oy + sc.number() });
        break;
      }
      case 'S': {
        const c1 = lastC2 ? { x: 2 * cx - lastC2.x, y: 2 * cy - lastC2.y } : { x: cx, y: cy };
        const c2 = { x: ox + sc.number(), y: oy + sc.number() };
        cubic(c1, c2, { x: ox + sc.number(), y: oy + sc.number() });
        break;
      }
      case 'Q': case 'T': {
        const q: Pt = cmd.toUpperCase() === 'T'
          ? (lastQ ? { x: 2 * cx - lastQ.x, y: 2 * cy - lastQ.y } : { x: cx, y: cy })
          : { x: ox + sc.number(), y: oy + sc.number() };
        const p = { x: ox + sc.number(), y: oy + sc.number() };
        const from = { x: cx, y: cy };
        cubic(
          { x: from.x + (2 / 3) * (q.x - from.x), y: from.y + (2 / 3) * (q.y - from.y) },
          { x: p.x + (2 / 3) * (q.x - p.x), y: p.y + (2 / 3) * (q.y - p.y) },
          p
        );
        lastQ = q; lastC2 = null;
        break;
      }
      case 'A': {
        const rx = sc.number(), ry = sc.number(), rot = sc.number();
        const large = sc.flag(), sweep = sc.flag();
        const p = { x: ox + sc.number(), y: oy + sc.number() };
        for (const seg of arcToCubics(cx, cy, rx, ry, rot, large, sweep, p.x, p.y)) cubic(seg.c1, seg.c2, seg.p);
        lastC2 = null;
        break;
      }
      case 'Z': {
        if (nodes.length) {
          closed = true;
          // A closing segment that returns to the start merges into it.
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (nodes.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) {
            if (last.h1) first.h1 = last.h1;
            nodes.pop();
          }
          flush();
        }
        cx = sx; cy = sy; lastC2 = null; lastQ = null;
        break;
      }
      default: throw new Error(`unsupported path command ${cmd}`);
    }
  }
  flush();
  return subs;
}

// ------------------------------------------------------------- geometry util

export function boundsOf(nodes: PathNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const see = (p?: Pt) => { if (!p) return; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); };
  for (const n of nodes) { see(n); see(n.h1); see(n.h2); }
  return { minX, minY, maxX, maxY };
}

// Maps nodes (handles too) from `from` bounds into 0..100 space, or into the
// rectangle given by `into` (also in 0..100) when set.
export function normalizeNodes(
  nodes: PathNode[],
  from: { minX: number; minY: number; maxX: number; maxY: number },
  into: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 100, h: 100 }
): PathNode[] {
  const w = from.maxX - from.minX || 1, h = from.maxY - from.minY || 1;
  const mx = (v: number) => into.x + ((v - from.minX) / w) * into.w;
  const my = (v: number) => into.y + ((v - from.minY) / h) * into.h;
  return nodes.map((n) => ({
    ...n,
    x: mx(n.x), y: my(n.y),
    ...(n.h1 ? { h1: { x: mx(n.h1.x), y: my(n.h1.y) } } : {}),
    ...(n.h2 ? { h2: { x: mx(n.h2.x), y: my(n.h2.y) } } : {})
  }));
}

export type Matrix = [number, number, number, number, number, number]; // a b c d e f
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}

export function parseTransform(s: string | null | undefined): Matrix {
  let m: Matrix = IDENTITY;
  if (!s) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let t: RegExpExecArray | null;
  while ((t = re.exec(s))) {
    const a = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let n: Matrix = IDENTITY;
    switch (t[1]) {
      case 'matrix': if (a.length === 6) n = a as Matrix; break;
      case 'translate': n = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': n = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break;
      case 'rotate': {
        const r = ((a[0] ?? 0) * Math.PI) / 180, c = Math.cos(r), si = Math.sin(r);
        n = [c, si, -si, c, 0, 0];
        if (a.length >= 3) n = multiply(multiply([1, 0, 0, 1, a[1], a[2]], n), [1, 0, 0, 1, -a[1], -a[2]]);
        break;
      }
      case 'skewX': n = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': n = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break;
    }
    m = multiply(m, n);
  }
  return m;
}

export function transformNodes(nodes: PathNode[], m: Matrix): PathNode[] {
  const tp = (p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
  return nodes.map((n) => ({
    ...n,
    ...tp(n),
    ...(n.h1 ? { h1: tp(n.h1) } : {}),
    ...(n.h2 ? { h2: tp(n.h2) } : {})
  }));
}

// -------------------------------------------------------------- freehand

// Ramer-Douglas-Peucker: drops points that lie within `eps` of the line
// through their neighbors, keeping the stroke's shape.
export function simplifyRDP(points: Pt[], eps: number): Pt[] {
  if (points.length < 3) return points.slice();
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let far = -1, fd = 0;
    const A = points[a], B = points[b];
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const P = points[i];
      const d = len === 0 ? Math.hypot(P.x - A.x, P.y - A.y) : Math.abs(dy * P.x - dx * P.y + B.x * A.y - B.y * A.x) / len;
      if (d > fd) { fd = d; far = i; }
    }
    if (far >= 0 && fd > eps) { keep[far] = true; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

// Catmull-Rom handles through every anchor (closed), so a simplified stroke
// reads as a smooth outline.
export function smoothAll(nodes: PathNode[]): PathNode[] {
  const n = nodes.length;
  return nodes.map((p, i) => {
    const a = nodes[(i - 1 + n) % n], b = nodes[(i + 1) % n];
    const tx = (b.x - a.x) / 6, ty = (b.y - a.y) / 6;
    return { x: p.x, y: p.y, h1: { x: p.x - tx, y: p.y - ty }, h2: { x: p.x + tx, y: p.y + ty }, smooth: true };
  });
}

// A drawn stroke -> closed smooth path (or null if it was just a click).
export function freehandToNodes(points: Pt[], eps = 1): PathNode[] | null {
  if (points.length < 3) return null;
  let pts = simplifyRDP(points, eps);
  // Drop a closing point that repeats the start.
  if (pts.length > 3 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < eps * 2) pts = pts.slice(0, -1);
  if (pts.length < 3) return null;
  return smoothAll(pts.map((p) => ({ x: p.x, y: p.y })));
}

// ------------------------------------------------------------ generators

// Regular polygon / star, centered in the 0..100 space. rx and ry let the
// caller compensate for a non-square block so the result looks regular.
export function polygonNodes(sides: number, rx = 50, ry = 50): PathNode[] {
  const n = Math.max(3, Math.min(24, Math.round(sides)));
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a) };
  });
}

export function starNodes(points: number, inner = 0.45, rx = 50, ry = 50): PathNode[] {
  const n = Math.max(3, Math.min(24, Math.round(points)));
  const r = Math.max(0.1, Math.min(0.9, inner));
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const k = i % 2 === 0 ? 1 : r;
    return { x: 50 + rx * k * Math.cos(a), y: 50 + ry * k * Math.sin(a) };
  });
}
