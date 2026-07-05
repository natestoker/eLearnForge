import type { TextAnim } from '../../schema/types';

// Stateless text entrances. Instead of a fire-once GSAP tween (which cannot
// reverse when the seekbar scrubs backward), each unit's visibility is a
// pure function of overall progress p (0..1). The runtime recomputes p from
// the timeline every frame, so scrubbing in either direction just re-applies
// the correct state - the same discipline as the rest of the timeline.

export interface TextUnit {
  el: HTMLElement;
  // Fraction of the total animation window this unit begins at (stagger).
  offset: number;
}

// Wrap text nodes into per-word or per-letter spans once; returns the units
// with their stagger offsets. Idempotent-ish: callers cache the result.
export function buildUnits(root: HTMLElement, anim: TextAnim): TextUnit[] | null {
  const unit: 'word' | 'letter' | null =
    anim === 'wordsUp' ? 'word' :
    anim === 'typewriter' || anim === 'lettersUp' ? 'letter' : null;
  if (!unit) return null;

  const spans: HTMLElement[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n = walker.nextNode();
  while (n) { textNodes.push(n as Text); n = walker.nextNode(); }
  for (const tn of textNodes) {
    const text = tn.nodeValue ?? '';
    if (!text.trim()) continue;
    const frag = document.createDocumentFragment();
    const parts = unit === 'word' ? text.split(/(\s+)/) : Array.from(text);
    for (const part of parts) {
      // Whitespace stays a plain text node in BOTH modes. Wrapping a space
      // in an inline-block span collapses it, which is what made the
      // typewriter eat spaces. Only real glyphs become animatable spans.
      if (/^\s+$/.test(part) || part === ' ') {
        frag.appendChild(document.createTextNode(part));
        continue;
      }
      if (part === '') continue;
      const span = document.createElement('span');
      span.textContent = part;
      span.style.display = 'inline-block';
      span.style.willChange = 'transform, opacity';
      frag.appendChild(span);
      spans.push(span);
    }
    tn.parentNode?.replaceChild(frag, tn);
  }
  const count = spans.length || 1;
  // Each unit occupies a fraction of the window; last starts at ~0.6 so the
  // whole thing finishes by p=1.
  return spans.map((el, i) => ({ el, offset: (i / count) * 0.6 }));
}

function unitProgress(p: number, offset: number): number {
  const span = 0.4; // each unit animates over 40% of the window
  return Math.max(0, Math.min(1, (p - offset) / span));
}

// Apply the animation at overall progress p (0..1). Works for whole-element
// anims (fade/blur) and unit anims (typewriter/words/letters).
export function applyTextAnim(root: HTMLElement, anim: TextAnim, p: number, units: TextUnit[] | null): void {
  if (anim === 'fadeIn') {
    root.style.opacity = String(p);
    return;
  }
  if (anim === 'blurIn') {
    root.style.opacity = String(p);
    root.style.filter = `blur(${(1 - p) * 12}px)`;
    return;
  }
  if (!units) return;
  for (const u of units) {
    const up = unitProgress(p, u.offset);
    if (anim === 'typewriter') {
      u.el.style.opacity = up > 0 ? '1' : '0';
    } else if (anim === 'wordsUp') {
      u.el.style.opacity = String(up);
      u.el.style.transform = `translateY(${(1 - up) * 0.6}em)`;
    } else if (anim === 'lettersUp') {
      u.el.style.opacity = String(up);
      u.el.style.transform = `translateY(${(1 - up) * 0.7}em)`;
    }
  }
}
