import type { Block, ReflectionSpec, ShadowSpec } from '../schema/types';

// PowerPoint-style reflection: a mirrored copy hugging one edge of the block,
// fading out away from it. Implemented with -webkit-box-reflect
// (Chromium/WebKit); the mask is a gradient - opaque nearest the block,
// fading to transparent over `size` fraction of the reflection.
//
// -webkit-box-reflect mirrors the element AND its mask together: the mask is
// authored in the element's own (pre-flip) top-to-bottom/left-to-right frame,
// then the whole thing is flipped into place. That means the edge of the
// element nearest the reflection (e.g. the BOTTOM edge for a 'below'
// reflection) corresponds to the FAR end of a naive "to bottom" gradient, not
// the near end - so each direction needs its gradient axis reversed relative
// to where you'd naively expect, verified empirically against the rendered
// output. Get this wrong and the reflection floats a visible gap away from
// the block instead of hugging it.
const GRADIENT_DIR: Record<NonNullable<ReflectionSpec['direction']>, string> = {
  below: 'to top',
  above: 'to bottom',
  right: 'to left',
  left: 'to right'
};

export function reflectionCss(r: ReflectionSpec | undefined): string | undefined {
  if (!r || r.opacity <= 0) return undefined;
  const op = Math.max(0, Math.min(1, r.opacity)).toFixed(2);
  const fade = Math.max(1, Math.min(100, (r.size || 0.5) * 100)).toFixed(0);
  const dir = r.direction ?? 'below';
  const gradientDir = GRADIENT_DIR[dir];
  return `${dir} ${Math.max(0, r.distance)}px linear-gradient(${gradientDir}, rgba(255,255,255,${op}) 0%, transparent ${fade}%)`;
}

export const REFLECTION_PRESETS: { label: string; spec: ReflectionSpec }[] = [
  { label: 'Tight', spec: { opacity: 0.5, size: 0.5, distance: 2, direction: 'below' } },
  { label: 'Half', spec: { opacity: 0.5, size: 0.6, distance: 4, direction: 'below' } },
  { label: 'Full', spec: { opacity: 0.45, size: 1, distance: 6, direction: 'below' } }
];

// PowerPoint-style shadows, one implementation for every block type.
// Outer shadows render as a CSS drop-shadow filter on the block's content
// wrapper (editor and player alike), so they follow the real silhouette -
// SVG geometry, callout tails, clipped images - not the block rectangle.
// Inner shadows render inside ShapeSvg via an SVG filter (shapes) or as an
// inset box-shadow overlay (rect-ish blocks).

export function effectiveShadow(block: Block): ShadowSpec | undefined {
  if (block.shadow) return block.shadow;
  // Legacy boolean ShapeProps.shadow (pre-v6.3 and old PPTX imports).
  const legacy = (block.props as { shadow?: unknown }).shadow;
  if (legacy === true) return { color: '#000000', opacity: 0.16, blur: 16, distance: 6, angle: 90 };
  return undefined;
}

export function shadowRgba(s: ShadowSpec): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.color.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, s.opacity)).toFixed(2)})`;
}

export function shadowOffset(s: ShadowSpec): { dx: number; dy: number } {
  const rad = (s.angle * Math.PI) / 180;
  return { dx: Math.cos(rad) * s.distance, dy: Math.sin(rad) * s.distance };
}

// CSS filter for an OUTER shadow (undefined for inner - those render in
// the block's own geometry).
export function outerShadowFilter(s: ShadowSpec | undefined): string | undefined {
  if (!s || s.inner) return undefined;
  const { dx, dy } = shadowOffset(s);
  return `drop-shadow(${dx.toFixed(1)}px ${dy.toFixed(1)}px ${s.blur}px ${shadowRgba(s)})`;
}

// Inset box-shadow for rect-ish content (text, images, buttons). Shapes use
// the SVG filter instead so the shadow hugs the geometry.
export function innerShadowBoxCss(s: ShadowSpec | undefined): string | undefined {
  if (!s || !s.inner) return undefined;
  const { dx, dy } = shadowOffset(s);
  return `inset ${dx.toFixed(1)}px ${dy.toFixed(1)}px ${s.blur}px ${s.spread ?? 0}px ${shadowRgba(s)}`;
}

// Block-level content styling shared verbatim by the editor canvas and the
// player: the shadow, plus rotation (both live on the same wrapper so the
// shadow rotates with the content). Shape blocks draw inner shadows inside
// their own SVG; other blocks approximate inner with an inset box-shadow.
export function shadowStyle(block: Block): React.CSSProperties {
  const out: React.CSSProperties = {};
  if (block.rotation) out.transform = `rotate(${block.rotation}deg)`;
  const s = effectiveShadow(block);
  if (s) {
    if (!s.inner) out.filter = outerShadowFilter(s);
    else if (block.type !== 'shape') out.boxShadow = innerShadowBoxCss(s);
  }
  const refl = reflectionCss(block.reflection);
  // WebkitBoxReflect isn't in the CSSProperties type; set it through an index.
  if (refl) (out as Record<string, string>).WebkitBoxReflect = refl;
  return out;
}

// PowerPoint's preset gallery, trimmed to the ones people reach for.
export const SHADOW_PRESETS: { label: string; spec: ShadowSpec }[] = [
  { label: 'Offset: bottom right', spec: { color: '#000000', opacity: 0.35, blur: 8, distance: 6, angle: 45 } },
  { label: 'Offset: bottom', spec: { color: '#000000', opacity: 0.35, blur: 8, distance: 6, angle: 90 } },
  { label: 'Offset: bottom left', spec: { color: '#000000', opacity: 0.35, blur: 8, distance: 6, angle: 135 } },
  { label: 'Soft: below', spec: { color: '#000000', opacity: 0.2, blur: 20, distance: 10, angle: 90 } },
  { label: 'Glow: centered', spec: { color: '#000000', opacity: 0.3, blur: 14, distance: 0, angle: 90 } },
  { label: 'Inner: top left', spec: { inner: true, color: '#000000', opacity: 0.4, blur: 8, distance: 5, angle: 45 } },
  { label: 'Inner: bottom', spec: { inner: true, color: '#000000', opacity: 0.4, blur: 8, distance: 5, angle: 270 } }
];
