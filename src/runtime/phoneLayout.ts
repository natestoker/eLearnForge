import type { Block, Slide } from '../schema/types';

// How a slide is shown on a phone held upright.
//   reflow: its blocks become one scrolling column at real text sizes.
//   fit:    the 16:9 stage is scaled to the screen, as on a desktop. Used when
//           the slide's meaning depends on where things are.
// Authors can force either per slide (Slide inspector > Phone layout).

export type PhoneMode = 'reflow' | 'fit';
export interface PhoneDecision { mode: PhoneMode; reason: string }

const POSITIONAL = new Set(['hotspot', 'labeledGraphic']);

const flat = (blocks: Block[]): Block[] =>
  blocks.flatMap((b) => (b.type === 'group' ? [b, ...flat((b.props as { blocks: Block[] }).blocks)] : [b]));

// A shape with nothing to click and nothing to read is decoration: it is left
// out of the reflowed column and ignored when looking for overlaps.
export function isDecorative(block: Block, slide: Slide): boolean {
  if (block.type !== 'shape') return false;
  if (block.stateStyles && Object.keys(block.stateStyles).length) return false;
  return !slide.triggers.some((t) => t.sourceBlockId === block.id);
}

function overlapShare(a: Block, b: Block): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.max(1, Math.min(a.w * a.h, b.w * b.h));
}

export function phoneLayoutFor(slide: Slide): PhoneDecision {
  if (slide.phoneLayout === 'reflow') return { mode: 'reflow', reason: 'set by the author' };
  if (slide.phoneLayout === 'fit') return { mode: 'fit', reason: 'set by the author' };
  for (const layer of slide.layers) {
    const all = flat(layer.blocks);
    const positional = all.find((b) => POSITIONAL.has(b.type));
    if (positional) return { mode: 'fit', reason: positional.type === 'hotspot' ? 'it has a hotspot' : 'it has a labelled graphic' };
    if (all.some((b) => b.motion && !isDecorative(b, slide))) return { mode: 'fit', reason: 'a block moves along a path' };
    if (layer.blocks.some((b) => b.type === 'group')) return { mode: 'fit', reason: 'it has grouped objects' };
    const real = layer.blocks.filter((b) => !b.editorHidden && !isDecorative(b, slide));
    for (let i = 0; i < real.length; i++) {
      for (let j = i + 1; j < real.length; j++) {
        if (overlapShare(real[i], real[j]) > 0.25) return { mode: 'fit', reason: 'blocks overlap' };
      }
    }
  }
  return { mode: 'reflow', reason: 'nothing depends on position' };
}

// A slide's own "Continue" button that only goes to the next slide duplicates
// the player's Next. In the column it is left out, so there is one way forward.
export function isPlainNextButton(block: Block, slide: Slide, nextSlideId: string | null): boolean {
  if (block.type !== 'button') return false;
  const mine = slide.triggers.filter((t) => t.sourceBlockId === block.id && t.enabled !== false);
  if (mine.length !== 1) return false;
  const t = mine[0];
  if (t.event !== 'onClick' || t.conditions.length || t.actions.length !== 1) return false;
  const a = t.actions[0];
  return a.type === 'nextSlide' || (a.type === 'goToSlide' && nextSlideId !== null && a.slideId === nextSlideId);
}

// Reading order for the column: top to bottom, and left to right within a row
// (blocks whose tops are within 32px count as one row).
export function reflowOrder(blocks: Block[]): Block[] {
  return [...blocks].sort((a, b) => (Math.abs(a.y - b.y) > 32 ? a.y - b.y : a.x - b.x));
}

// Text sized for a 1280px slide is too big or too small at phone width: keep
// body text at 16px or more and pull headings in.
export function reflowFontScale(fontSize: number): number {
  const fs = fontSize || 16;
  const target = fs <= 20 ? Math.max(16, fs) : Math.min(30, 20 + (fs - 20) * 0.3);
  return target / fs;
}
