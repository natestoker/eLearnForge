import type { PathNode } from '../../schema/types';
import {
  IDENTITY, Matrix, Subpath, boundsOf, multiply, normalizeNodes, parsePathData, parseTransform, transformNodes
} from './pathTools';

// Reads an SVG document into editable vector shapes. Handles paths, rects
// (with rounded corners), circles, ellipses, lines, polylines and polygons,
// nested <g> transforms, and fill / stroke from attributes or style="".
// What it can't carry across (gradients, text, images, <use>, clip paths) is
// listed in `notes` so nobody is surprised by the result.

export interface SvgShape {
  nodes: PathNode[];        // in the SVG's own units, transforms applied
  closed: boolean;
  fill: string | null;      // null = no fill
  stroke: string | null;    // null = no stroke
  strokeWidth: number;
}
export interface SvgImport { shapes: SvgShape[]; notes: string[] }

interface Paint { fill: string | null; stroke: string | null; strokeWidth: number; m: Matrix }

const SKIP = new Set(['defs', 'clippath', 'mask', 'symbol', 'title', 'desc', 'metadata', 'style', 'lineargradient', 'radialgradient', 'pattern', 'filter', 'marker']);
const UNSUPPORTED = new Set(['text', 'image', 'use', 'foreignobject']);

function declarations(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'display', 'visibility']) {
    const v = el.getAttribute(a);
    if (v !== null) out[a] = v.trim();
  }
  const style = el.getAttribute('style');
  if (style) {
    for (const part of style.split(';')) {
      const i = part.indexOf(':');
      if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
    }
  }
  return out;
}

function paint(v: string | undefined, inherited: string | null, notes: Set<string>): string | null {
  if (v === undefined || v === 'inherit') return inherited;
  if (v === 'none' || v === 'transparent') return null;
  if (v === 'currentColor') return '#000000';
  if (v.startsWith('url(')) { notes.add('Gradients and patterns were replaced with a flat grey.'); return '#8a8f98'; }
  return v;
}

const num = (el: Element, a: string, d = 0) => {
  const v = parseFloat(el.getAttribute(a) ?? '');
  return Number.isFinite(v) ? v : d;
};

function elementPaths(el: Element): string | null {
  switch (el.tagName.toLowerCase()) {
    case 'path': return el.getAttribute('d');
    case 'rect': {
      const x = num(el, 'x'), y = num(el, 'y'), w = num(el, 'width'), h = num(el, 'height');
      if (w <= 0 || h <= 0) return null;
      let rx = num(el, 'rx', NaN), ry = num(el, 'ry', NaN);
      if (Number.isNaN(rx)) rx = Number.isNaN(ry) ? 0 : ry;
      if (Number.isNaN(ry)) ry = rx;
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
      if (rx <= 0 || ry <= 0) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    case 'circle': case 'ellipse': {
      const cx = num(el, 'cx'), cy = num(el, 'cy');
      const rx = el.tagName.toLowerCase() === 'circle' ? num(el, 'r') : num(el, 'rx');
      const ry = el.tagName.toLowerCase() === 'circle' ? rx : num(el, 'ry');
      if (rx <= 0 || ry <= 0) return null;
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    case 'line': return `M${num(el, 'x1')} ${num(el, 'y1')}L${num(el, 'x2')} ${num(el, 'y2')}`;
    case 'polyline': case 'polygon': {
      const pts = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (pts.length < 4 || pts.some((n) => !Number.isFinite(n))) return null;
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return el.tagName.toLowerCase() === 'polygon' ? d + 'Z' : d;
    }
  }
  return null;
}

export function parseSvgText(text: string): SvgImport {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('That file is not a valid SVG.');
  }
  const shapes: SvgShape[] = [];
  const notes = new Set<string>();
  let openClosed = 0;

  const walk = (el: Element, inh: Paint) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) { if (tag !== 'title' && tag !== 'desc' && tag !== 'metadata' && tag !== 'style') notes.add(`<${tag}> content was not imported.`); return; }
    if (UNSUPPORTED.has(tag)) { notes.add(`<${tag}> elements were skipped (only vector shapes are imported).`); return; }
    const dec = declarations(el);
    if (dec.display === 'none' || dec.visibility === 'hidden') return;
    const m = multiply(inh.m, parseTransform(el.getAttribute('transform')));
    const sw = dec['stroke-width'] !== undefined ? parseFloat(dec['stroke-width']) : inh.strokeWidth;
    const here: Paint = {
      fill: paint(dec.fill, inh.fill, notes),
      stroke: paint(dec.stroke, inh.stroke, notes),
      strokeWidth: Number.isFinite(sw) ? sw : 1,
      m
    };
    const d = elementPaths(el);
    if (d) {
      let subs: Subpath[] = [];
      try { subs = parsePathData(d); } catch { notes.add('A path with unreadable data was skipped.'); }
      for (const s of subs) {
        if (s.nodes.length < 2) continue;
        const nodes = transformNodes(s.nodes, m);
        // Scale the stroke by the transform's average scale.
        const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
        const isOpen = !s.closed;
        if (isOpen && nodes.length >= 3 && here.fill) openClosed++;
        shapes.push({ nodes, closed: s.closed, fill: isOpen && nodes.length === 2 ? null : here.fill, stroke: here.stroke, strokeWidth: here.strokeWidth * scale });
      }
    }
    for (const child of Array.from(el.children)) walk(child, here);
  };

  walk(root, { fill: '#000000', stroke: null, strokeWidth: 1, m: IDENTITY });
  if (openClosed) notes.add(`${openClosed} open path${openClosed === 1 ? ' was' : 's were'} closed to make a filled shape.`);
  if (!shapes.length) throw new Error('No vector shapes were found in that SVG.');
  return { shapes, notes: [...notes] };
}

// The biggest closed outline in the file, as 0..100 nodes that keep their
// aspect ratio inside a block of the given pixel size. For the pen tool,
// which edits one path at a time.
export function largestOutline(svg: SvgImport, blockW: number, blockH: number): PathNode[] {
  const candidates = svg.shapes.filter((s) => s.nodes.length >= 3);
  if (!candidates.length) throw new Error('That SVG has no closed outline to edit.');
  let best = candidates[0], bestArea = -1;
  for (const s of candidates) {
    const b = boundsOf(s.nodes);
    const area = (b.maxX - b.minX) * (b.maxY - b.minY);
    if (area > bestArea) { best = s; bestArea = area; }
  }
  const b = boundsOf(best.nodes);
  const w = b.maxX - b.minX || 1, h = b.maxY - b.minY || 1;
  const k = Math.min(blockW / w, blockH / h);
  const wp = ((w * k) / blockW) * 100, hp = ((h * k) / blockH) * 100;
  return normalizeNodes(best.nodes, b, { x: (100 - wp) / 2, y: (100 - hp) / 2, w: wp, h: hp });
}
