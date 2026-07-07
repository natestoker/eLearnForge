import type { PathNode, ShapeKind } from '../../schema/types';

// Preset geometry in a 100x100 viewBox, stretched non-uniformly to the
// block bounds (preserveAspectRatio none) - the PowerPoint model. Points
// are polygons; rectangle/rounded/ellipse/paths render as native SVG elements.

export const SHAPE_POINTS: Partial<Record<ShapeKind, string>> = {
  triangle: '50,0 100,100 0,100',
  rightTriangle: '0,0 100,100 0,100',
  diamond: '50,0 100,50 50,100 0,50',
  pentagon: '50,0 100,38 81,100 19,100 0,38',
  hexagon: '25,0 75,0 100,50 75,100 25,100 0,50',
  star: '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35',
  arrowRight: '0,30 60,30 60,10 100,50 60,90 60,70 0,70',
  arrowLeft: '100,30 40,30 40,10 0,50 40,90 40,70 100,70',
  arrowUp: '30,100 30,40 10,40 50,0 90,40 70,40 70,100',
  arrowDown: '30,0 30,60 10,60 50,100 90,60 70,60 70,0',
  chevron: '0,0 75,0 100,50 75,100 0,100 25,50',
  parallelogram: '25,0 100,0 75,100 0,100',
  trapezoid: '20,0 80,0 100,100 0,100',
  
  // New Polygon Shapes
  octagon: '29,0 71,0 100,29 100,71 71,100 29,100 0,71 0,29',
  plus: '35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35',
  lightningBolt: '60,0 10,60 45,60 30,100 90,40 55,40',
  heptagon: '50,0 89,18 100,60 72,97 28,97 0,60 11,18',
  decagon: '50,0 79,9 98,34 98,66 79,91 50,100 21,91 2,66 2,34 21,9',
  dodecagon: '50,0 75,7 93,25 100,50 93,75 75,93 50,100 25,93 7,75 0,50 7,25 25,7',
  explosion: '50,0 55,20 70,10 65,30 85,25 75,45 100,50 75,55 85,75 65,70 70,90 55,80 50,100 45,80 30,90 35,70 15,75 25,55 0,50 25,45 15,25 35,30 30,10 45,20',
  sun: '50,10 55,30 70,20 62,38 85,35 68,48 90,50 68,52 85,65 62,62 70,80 55,70 50,90 45,70 30,80 38,62 15,65 32,48 10,50 32,52 15,35 38,38 30,20 45,30'
};

export const SHAPE_PATHS: Partial<Record<ShapeKind, string>> = {
  heart: 'M 50,20 C 50,20 38,0 20,0 C 8,0 0,10 0,25 C 0,45 25,75 50,100 C 75,75 100,45 100,25 C 100,10 92,0 80,0 C 62,0 50,20 50,20 Z',
  smileyFace: 'M 50,0 A 50,50 0 1,0 50,100 A 50,50 0 1,0 50,0 Z M 35,35 A 5,5 0 1,1 35,45 A 5,5 0 1,1 35,35 Z M 65,35 A 5,5 0 1,1 65,45 A 5,5 0 1,1 65,35 Z M 25,60 C 25,60 35,80 50,80 C 65,80 75,60 75,60 C 75,60 65,72 50,72 C 35,72 25,60 25,60 Z',
  cloud: 'M 25,80 C 15,80 5,70 5,55 C 5,42 15,32 28,32 C 33,18 48,10 62,15 C 75,20 82,32 82,45 C 92,45 100,53 100,65 C 100,75 92,80 82,80 Z',
  moon: 'M 80,10 A 45,45 0 1,0 80,90 A 35,35 0 1,1 80,10 Z',
  // Cylinder: closed body, then the top ellipse as its own CLOSED subpath.
  // (The old version used open subpaths for the stripes, which fill-painted
  // as lens shapes and stroked as floating arcs - it looked broken.)
  database:
    'M 10,14 C 10,4 90,4 90,14 L 90,86 C 90,96 10,96 10,86 Z ' +
    'M 10,14 C 10,24 90,24 90,14 C 90,4 10,4 10,14 Z',
  flowchartDocument: 'M 0,0 L 100,0 L 100,80 C 75,70 50,90 0,80 Z',
  flowchartTerminator: 'M 25,0 L 75,0 C 90,0 100,20 100,50 C 100,80 90,100 75,100 L 25,100 C 10,100 0,80 0,50 C 0,20 10,0 25,0 Z',
  scrollHorizontal: 'M 10,20 C 5,20 0,30 0,40 L 0,80 C 0,90 5,100 10,100 L 90,100 C 95,100 100,90 100,80 L 100,40 C 100,30 95,20 90,20 Z M 10,20 L 90,20',
  leftRightArrow: 'M 0,50 L 25,20 L 25,35 L 75,35 L 75,20 L 100,50 L 75,80 L 75,65 L 25,65 L 25,80 Z',
  upDownArrow: 'M 50,0 L 80,25 L 65,25 L 65,75 L 80,75 L 50,100 L 20,75 L 35,75 L 35,25 L 20,25 Z',
  quadArrow: 'M 50,0 L 65,15 L 58,15 L 58,42 L 85,42 L 85,35 L 100,50 L 85,65 L 85,58 L 58,58 L 58,85 L 65,85 L 50,100 L 35,85 L 42,85 L 42,58 L 15,58 L 15,65 L 0,50 L 15,35 L 15,42 L 42,42 L 42,15 L 35,15 Z',
  stripedRightArrow: 'M 0,30 L 10,30 L 10,70 L 0,70 Z M 20,30 L 30,30 L 30,70 L 20,70 Z M 40,30 L 60,30 L 60,15 L 100,50 L 60,85 L 60,70 L 40,70 Z',
  notchedRightArrow: 'M 15,30 L 60,30 L 60,15 L 100,50 L 60,85 L 60,70 L 15,70 L 30,50 Z'
};

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rectangle: 'Rectangle',
  roundedRectangle: 'Rounded rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  rightTriangle: 'Right triangle',
  diamond: 'Diamond',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  star: 'Star 5-point',
  arrowRight: 'Arrow right',
  arrowLeft: 'Arrow left',
  arrowUp: 'Arrow up',
  arrowDown: 'Arrow down',
  chevron: 'Chevron',
  parallelogram: 'Parallelogram',
  trapezoid: 'Trapezoid',
  
  // New Shapes
  octagon: 'Octagon',
  plus: 'Plus / Cross',
  heart: 'Heart',
  lightningBolt: 'Lightning bolt',
  smileyFace: 'Smiley face',
  cloud: 'Cloud',
  sun: 'Sun',
  moon: 'Moon',
  heptagon: 'Heptagon',
  decagon: 'Decagon',
  dodecagon: 'Dodecagon',
  database: 'Flowchart Database',
  flowchartDocument: 'Flowchart Document',
  flowchartTerminator: 'Flowchart Terminator',
  explosion: 'Explosion / Star 24-point',
  scrollHorizontal: 'Scroll horizontal',
  calloutRectangle: 'Callout rectangle',
  calloutRoundRect: 'Callout rounded rectangle',
  calloutEllipse: 'Callout oval',
  leftRightArrow: 'Left-right arrow',
  upDownArrow: 'Up-down arrow',
  quadArrow: 'Quad arrow',
  stripedRightArrow: 'Striped right arrow',
  notchedRightArrow: 'Notched right arrow'
};

// PowerPoint prstGeom names -> our kinds (import mapping).
export const PRSTGEOM_TO_KIND: Record<string, ShapeKind> = {
  rect: 'rectangle',
  roundRect: 'roundedRectangle',
  ellipse: 'ellipse',
  triangle: 'triangle',
  rtTriangle: 'rightTriangle',
  diamond: 'diamond',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  star5: 'star',
  rightArrow: 'arrowRight',
  leftArrow: 'arrowLeft',
  upArrow: 'arrowUp',
  downArrow: 'arrowDown',
  chevron: 'chevron',
  parallelogram: 'parallelogram',
  trapezoid: 'trapezoid',
  
  // New PPTX Mappings
  octagon: 'octagon',
  plus: 'plus',
  mathPlus: 'plus',
  heart: 'heart',
  lightning: 'lightningBolt',
  smiley: 'smileyFace',
  cloud: 'cloud',
  sun: 'sun',
  moon: 'moon',
  heptagon: 'heptagon',
  decagon: 'decagon',
  dodecagon: 'dodecagon',
  flowchartDatabase: 'database',
  flowchartDocument: 'flowchartDocument',
  flowchartTerminator: 'flowchartTerminator',
  irregSeal1: 'explosion',
  star24: 'explosion',
  horizontalScroll: 'scrollHorizontal',
  wedgeRectCallout: 'calloutRectangle',
  wedgeRoundRectCallout: 'calloutRoundRect',
  wedgeEllipseCallout: 'calloutEllipse',
  leftRightArrow: 'leftRightArrow',
  upDownArrow: 'upDownArrow',
  quadArrow: 'quadArrow',
  stripedRightArrow: 'stripedRightArrow',
  notchedRightArrow: 'notchedRightArrow'
};

// Parametric callouts ---------------------------------------------------
// Callout bodies fill y = 0..70 of the shape space; the tail is a triangle
// from the body edge to a draggable tip (ShapeProps.tail), the Storyline /
// PowerPoint model. Tip coordinates may exceed 0..100 to reach outside the
// block (the SVG has overflow visible).

export const CALLOUT_BODY: Partial<Record<ShapeKind, 'rect' | 'roundRect' | 'ellipse'>> = {
  calloutRectangle: 'rect',
  calloutRoundRect: 'roundRect',
  calloutEllipse: 'ellipse'
};

export const DEFAULT_TAIL = { x: 30, y: 100 };

const CALLOUT_CX = 50, CALLOUT_CY = 35; // body center in shape space
const CALLOUT_R = 12;                   // roundRect corner radius

// Distance from the body center to the boundary along unit direction
// (dx, dy). All three bodies are convex and star-shaped around the center,
// so every direction meets the boundary exactly once.
function calloutBoundaryDist(kind: ShapeKind, dx: number, dy: number): number {
  const body = CALLOUT_BODY[kind];
  if (body === 'ellipse') {
    return 1 / Math.sqrt((dx / 50) ** 2 + (dy / 35) ** 2);
  }
  const tx = dx !== 0 ? 50 / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? 35 / Math.abs(dy) : Infinity;
  let t = Math.min(tx, ty);
  if (body === 'roundRect') {
    // If the straight-edge hit lands inside a corner square, intersect the
    // ray with that corner's circle instead.
    const px = CALLOUT_CX + dx * t;
    const py = CALLOUT_CY + dy * t;
    const qx = Math.max(CALLOUT_R, Math.min(100 - CALLOUT_R, px));
    const qy = Math.max(CALLOUT_R, Math.min(70 - CALLOUT_R, py));
    if (qx !== px && qy !== py) {
      // Corner circle center nearest the hit.
      const ccx = px < 50 ? CALLOUT_R : 100 - CALLOUT_R;
      const ccy = py < 35 ? CALLOUT_R : 70 - CALLOUT_R;
      // Solve |center + t*d - cc|^2 = r^2 for the largest t.
      const ox = CALLOUT_CX - ccx, oy = CALLOUT_CY - ccy;
      const b = ox * dx + oy * dy;
      const c = ox * ox + oy * oy - CALLOUT_R * CALLOUT_R;
      const disc = b * b - c;
      if (disc >= 0) t = -b + Math.sqrt(disc);
    }
  }
  return t;
}

function calloutBoundaryPoint(kind: ShapeKind, angle: number): [number, number] {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const t = calloutBoundaryDist(kind, dx, dy);
  return [CALLOUT_CX + dx * t, CALLOUT_CY + dy * t];
}

// The whole callout as ONE closed path: the body boundary with the segment
// facing the tail replaced by two straight edges to the tip. A single
// subpath means the fill is solid and the stroke runs unbroken around the
// outline - no seams, no gaps at the joins, and clip-based effects (wipe)
// treat it exactly like any other shape. Tip coordinates may exceed 0..100
// to reach outside the block (the SVG has overflow visible).
export function calloutPath(kind: ShapeKind, tip: { x: number; y: number }): string {
  const dxr = tip.x - CALLOUT_CX, dyr = tip.y - CALLOUT_CY;
  const len = Math.hypot(dxr, dyr);
  const theta = Math.atan2(dyr, dxr);
  const bDist = len >= 1 ? calloutBoundaryDist(kind, dxr / len, dyr / len) : Infinity;
  const hasTail = len > bDist + 1; // tip must clear the boundary to draw a tail
  // Angular half-width of the tail base (~8 units of arc at the boundary).
  const delta = hasTail ? Math.asin(Math.min(0.6, 8 / bDist)) : 0;

  const N = 96; // boundary samples; dense enough that curves read smooth
  const pts: [number, number][] = [];
  const from = theta + delta;
  const span = 2 * Math.PI - 2 * delta;
  for (let i = 0; i <= N; i++) {
    pts.push(calloutBoundaryPoint(kind, from + (span * i) / N));
  }
  let d = `M ${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 1; i <= N; i++) d += ` L ${r1(pts[i][0])},${r1(pts[i][1])}`;
  if (hasTail) d += ` L ${r1(tip.x)},${r1(tip.y)}`;
  return d + ' Z';
}

// Editable vector paths -------------------------------------------------
// One engine powers custom shapes AND custom image clips: PathNode anchors
// with optional cubic Bezier handles, in the same 0..100 space as preset
// geometry. A segment is a straight line unless either end contributes a
// handle.

export function pathFromNodes(nodes: PathNode[], closed = true): string {
  if (nodes.length < 2) return '';
  let d = `M ${r1(nodes[0].x)},${r1(nodes[0].y)}`;
  const seg = (a: PathNode, b: PathNode) => {
    if (a.h2 || b.h1) {
      const c1 = a.h2 ?? { x: a.x, y: a.y };
      const c2 = b.h1 ?? { x: b.x, y: b.y };
      return ` C ${r1(c1.x)},${r1(c1.y)} ${r1(c2.x)},${r1(c2.y)} ${r1(b.x)},${r1(b.y)}`;
    }
    return ` L ${r1(b.x)},${r1(b.y)}`;
  };
  for (let i = 1; i < nodes.length; i++) d += seg(nodes[i - 1], nodes[i]);
  if (closed) {
    d += seg(nodes[nodes.length - 1], nodes[0]);
    d += ' Z';
  }
  return d;
}

// Migrate a legacy pen polygon to nodes. Smooth polygons get Catmull-Rom
// handles (the same curve smoothPathFromPoints drew), so re-editing keeps
// the shape the author saw.
export function nodesFromPoints(points: string, smooth?: boolean): PathNode[] {
  const pts = points.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  const n = pts.length;
  if (!smooth || n < 3) return pts.map(([x, y]) => ({ x, y }));
  return pts.map(([x, y], i) => {
    const p0 = pts[(i - 1 + n) % n];
    const p2 = pts[(i + 1) % n];
    const tx = (p2[0] - p0[0]) / 6, ty = (p2[1] - p0[1]) / 6;
    return { x, y, h1: { x: x - tx, y: y - ty }, h2: { x: x + tx, y: y + ty }, smooth: true };
  });
}

// Seed the pen editor from a preset's path (hearts, clouds, terminators...).
// Parses a single closed M/L/C subpath; returns null for paths the editor
// can't represent (arcs, multiple subpaths), which then seed blank.
export function nodesFromPresetPath(d: string): PathNode[] | null {
  if (/[AaQqTtSsHhVv]/.test(d)) return null;
  if ((d.match(/M/gi) ?? []).length > 1) return null;
  const tokens = d.match(/[MLCZmlcz]|-?\d*\.?\d+/g);
  if (!tokens) return null;
  const nodes: PathNode[] = [];
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'L') {
      nodes.push({ x: num(), y: num() });
    } else if (cmd === 'C') {
      const c1 = { x: num(), y: num() };
      const c2 = { x: num(), y: num() };
      const p = { x: num(), y: num() };
      if (nodes.length === 0) return null;
      nodes[nodes.length - 1].h2 = c1;
      nodes.push({ x: p.x, y: p.y, h1: c2 });
    } else if (cmd === 'Z' || cmd === 'z') {
      break;
    } else {
      return null; // relative commands or junk
    }
  }
  if (nodes.length >= 2) {
    const first = nodes[0], last = nodes[nodes.length - 1];
    // A path that returns to its start via a curve stores the closing
    // handles on the first node.
    if (Math.hypot(first.x - last.x, first.y - last.y) < 0.5) {
      if (last.h1) first.h1 = last.h1;
      if (last.h2) first.h2 = last.h2;
      nodes.pop();
    }
  }
  return nodes.length >= 3 ? nodes : null;
}

// Custom-shape smoothing: a closed Catmull-Rom spline through the pen nodes,
// emitted as cubic Beziers. Same 0..100 space as the polygon it replaces.
export function smoothPathFromPoints(points: string): string {
  const pts = points.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]);
  const n = pts.length;
  if (n < 3) return '';
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${r1(c1x)},${r1(c1y)} ${r1(c2x)},${r1(c2y)} ${p2[0]},${p2[1]}`;
  }
  return d + ' Z';
}
const r1 = (v: number) => Math.round(v * 10) / 10;

// A CSS clip-path polygon (percentages) for a preset shape kind. Used to clip
// image blocks to a shape. Rectangles/rounded/ellipse are handled separately
// by the caller (ellipse -> circle()/ellipse(), rect -> none/inset).
export function clipPathForKind(kind: ShapeKind): string | null {
  if (kind === 'ellipse') return 'ellipse(50% 50% at 50% 50%)';
  if (kind === 'rectangle' || kind === 'roundedRectangle') return null;
  if (SHAPE_PATHS[kind]) return null; // Path-based clip paths don't scale nicely in CSS without SVG clipPath tags
  const pts = SHAPE_POINTS[kind];
  if (!pts) return null;
  return pointsToClipPath(pts);
}

// Convert "x,y x,y ..." (0..100 space) into a CSS polygon() clip-path.
export function pointsToClipPath(points: string): string {
  const coords = points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return `${x}% ${y}%`;
    })
    .join(', ');
  return `polygon(${coords})`;
}
