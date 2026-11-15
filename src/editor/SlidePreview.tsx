import { useEffect, useRef, useState } from 'react';
import type { Block, Slide } from '../schema/types';
import { BLOCKS } from '../blocks/registry';
import { slideBackgroundStyle } from '../shared/background';

// A real (not wireframe) preview of a slide: the same Canvas renderers the
// editing stage uses, scaled down and made inert. Three things keep it cheap
// in a big deck:
//  - it only renders once it scrolls near the viewport,
//  - it re-renders after the author pauses (not per keystroke), and only when
//    the slide actually changed (a fingerprint that ignores the bulk of long
//    strings such as embedded images),
//  - video and audio are drawn as placeholders, never loaded.

const noop = () => {};

function fingerprint(slide: Slide): string {
  return JSON.stringify(slide, (_k, v) =>
    typeof v === 'string' && v.length > 256 ? `${v.length}:${v.slice(0, 32)}:${v.slice(-32)}` : v
  );
}

function PreviewBlock({ block }: { block: Block }) {
  if (block.editorHidden) return null;
  const def = BLOCKS[block.type];
  const heavy = block.type === 'video' || block.type === 'audio';
  return (
    <div
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
        pointerEvents: 'none'
      }}
    >
      {heavy || !def ? (
        <div style={{ width: '100%', height: '100%', background: 'rgba(147,165,152,0.25)', borderRadius: 8 }} />
      ) : (
        <def.Canvas block={block} selected={false} onUpdateProps={noop} />
      )}
    </div>
  );
}

export function SlidePreview({ slide }: { slide: Slide }) {
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [scale, setScale] = useState(0.1);
  const [shown, setShown] = useState<Slide>(slide);
  const lastSig = useRef<string>('');

  // Lazy: render only when close to the viewport.
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver((entries) => setNear(entries.some((e) => e.isIntersecting)), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Fit the slide to whatever width the panel gives the thumbnail.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / slide.width || 0.1);
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slide.width]);

  // Debounced refresh, only when the slide's content changed.
  useEffect(() => {
    if (!near) return;
    const first = lastSig.current === '';
    const t = setTimeout(() => {
      const sig = fingerprint(slide);
      if (sig !== lastSig.current) { lastSig.current = sig; setShown(slide); }
    }, first ? 0 : 450);
    return () => clearTimeout(t);
  }, [slide, near]);

  const layers = shown.layers.filter((l, i) => i === 0 || l.visibleByDefault);
  return (
    <div ref={host} className="slide-preview" aria-hidden="true" {...({ inert: "" } as object)}>
      {near && (
        <div
          className="slide-preview-stage"
          style={{ width: shown.width, height: shown.height, transform: `scale(${scale})`, ...slideBackgroundStyle(shown.background) }}
        >
          {layers.flatMap((l) => l.blocks).map((b) => <PreviewBlock key={b.id} block={b} />)}
        </div>
      )}
    </div>
  );
}
