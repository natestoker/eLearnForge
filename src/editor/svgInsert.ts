import type { Block, ShapeProps } from '../schema/types';
import { createBlock } from '../schema/factory';
import { boundsOf, normalizeNodes } from '../blocks/shape/pathTools';
import { parseSvgText, type SvgImport } from '../blocks/shape/svgImport';
import { useProjectStore } from '../state/projectStore';

const MAX_W = 480, MAX_H = 360;

// Turns a parsed SVG into blocks: one shape block for a single outline, or a
// group of shapes (each keeping its fill and stroke) for a drawing.
export function blocksFromSvg(svg: SvgImport): { blocks: Block[]; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of svg.shapes) {
    const b = boundsOf(s.nodes);
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY); maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
  }
  const gw = maxX - minX || 1, gh = maxY - minY || 1;
  const k = Math.min(MAX_W / gw, MAX_H / gh);
  const blocks: Block[] = svg.shapes.map((s) => {
    const b = boundsOf(s.nodes);
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    const blk = createBlock('shape', Math.round((b.minX - minX) * k), Math.round((b.minY - minY) * k));
    blk.w = Math.max(2, Math.round(bw * k));
    blk.h = Math.max(2, Math.round(bh * k));
    const p = blk.props as ShapeProps;
    if (s.nodes.length === 2) {
      // A straight line.
      const [a, c] = s.nodes;
      const fx = (v: number) => (bw ? ((v - b.minX) / bw) * 100 : 50);
      const fy = (v: number) => (bh ? ((v - b.minY) / bh) * 100 : 50);
      p.isLine = true;
      p.points = `${fx(a.x).toFixed(2)},${fy(a.y).toFixed(2)} ${fx(c.x).toFixed(2)},${fy(c.y).toFixed(2)}`;
      p.fill = 'transparent';
      blk.w = Math.max(blk.w, 2); blk.h = Math.max(blk.h, 2);
    } else {
      p.nodes = normalizeNodes(s.nodes, b);
    }
    if (s.fill) { p.fill = s.fill; p.noFill = false; } else if (s.nodes.length > 2) { p.noFill = true; }
    if (s.stroke) { p.borderColor = s.stroke; p.borderWidth = Math.max(1, Math.round(s.strokeWidth * k)); } else { p.borderWidth = 0; }
    return blk;
  });
  return { blocks, w: Math.round(gw * k), h: Math.round(gh * k) };
}

// Inserts the SVG on the current slide. Returns notes about anything that
// could not be carried across.
export function insertSvgText(text: string): { notes: string[]; shapes: number } {
  const svg = parseSvgText(text);
  const { blocks, w, h } = blocksFromSvg(svg);
  const store = useProjectStore.getState();
  if (blocks.length === 1) {
    const only = blocks[0];
    store.addBlock('shape', (b) => { b.w = only.w; b.h = only.h; b.props = only.props; });
  } else {
    store.addBlock('group', (b) => { b.w = w; b.h = h; (b.props as { blocks: Block[] }).blocks = blocks; });
  }
  return { notes: svg.notes, shapes: svg.shapes.length };
}
