import { useEffect, useRef, useState } from 'react';
import type { Runtime } from '../engine/runtime';
import type { Block, Slide } from '../schema/types';
import { BLOCKS } from '../blocks/registry';
import { blockStateAt, styleFor, timelineDuration } from '../engine/timeline';
import { accessibilityFor } from './accessibility';
import { slideBackgroundStyle } from '../shared/background';
import { shadowStyle } from '../shared/shadow';
import { useFocusTrap } from '../shared/useFocusTrap';
import { Lucide } from '../editor/lucide';
import { TimelineClock } from './TimelineClock';
import { BlockFx } from './BlockFx';

function allBlocks(slide: Slide): Block[] {
  const walk = (blocks: Block[]): Block[] =>
    blocks.flatMap((b) => (b.type === 'group' ? [b, ...walk((b.props as { blocks: Block[] }).blocks)] : [b]));
  return slide.layers.flatMap((l) => walk(l.blocks));
}

// A lightbox slide shown as a popup over the current slide. It draws the
// slide's visible layers and blocks, runs its own timeline (entrances, exits,
// motion paths and looping emphasis play as they do on a normal slide), and
// routes clicks to its own triggers. Escape or the close button closes it;
// keyboard focus stays inside while it is open.
export function Lightbox({ runtime, slide, stageW, stageH }: { runtime: Runtime; slide: Slide; stageW: number; stageH: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') runtime.closeLightbox(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [runtime]);

  // Its own clock: starts at 0 each time the lightbox opens.
  const duration = timelineDuration(slide.timeline, allBlocks(slide));
  const hasTimeline = duration > 0;
  const [t, setT] = useState(0);
  useEffect(() => {
    setT(0);
    if (!hasTimeline) return;
    const clock = new TimelineClock({
      duration,
      narrationSrc: slide.timeline?.narrationSrc,
      onTick: setT,
      onPlayState: () => { /* no transport in a lightbox */ },
      onEnd: () => { /* stays open at its end state */ }
    });
    clock.play();
    return () => clock.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id, hasTimeline]);

  const fit = Math.min(1, (stageW * 0.92) / slide.width, (stageH * 0.92) / slide.height);
  return (
    <div className="player-lightbox-backdrop">
      <div
        ref={ref}
        className="player-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={slide.name}
        style={{
          width: slide.width,
          height: slide.height,
          left: (stageW - slide.width * fit) / 2,
          top: (stageH - slide.height * fit) / 2,
          transform: `scale(${fit})`,
          transformOrigin: 'top left',
          ...slideBackgroundStyle(slide.background)
        }}
      >
        {slide.layers.map((layer) =>
          runtime.isLayerVisible(layer.id) ? (
            <div key={layer.id} className="player-layer">
              {layer.blocks.map((block) => {
                if (!runtime.isBlockVisible(block.id)) return null;
                const state = runtime.getBlockState(block.id);
                if (state === 'hidden') return null;
                const def = BLOCKS[block.type];
                const acc = accessibilityFor(block);
                const clickable = state !== 'disabled' && runtime.blockHasInteractionTrigger(block.id);
                const stateStyle = state !== 'normal' ? block.stateStyles?.[state as 'selected' | 'visited' | 'disabled'] : undefined;
                const tState = hasTimeline ? blockStateAt(t, block.timing, duration, block.motion) : null;
                const timed = tState ? styleFor(tState) : {};
                return (
                  <div
                    key={block.id}
                    data-block-id={block.id}
                    className={`player-block ${clickable ? 'clickable' : ''}`}
                    style={{
                      left: block.x, top: block.y, width: block.w, height: block.h,
                      ...timed,
                      ...(block.rotation ? { transform: `${timed.transform ?? ''} rotate(${block.rotation}deg)`.trim() } : {}),
                      ...(stateStyle?.opacity !== undefined ? { opacity: stateStyle.opacity } : {})
                    }}
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? 'button' : undefined}
                    aria-hidden={acc.hidden || undefined}
                    aria-label={acc.label}
                    onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); runtime.clickBlock(block.id); } } : undefined}
                    onPointerEnter={() => runtime.hoverBlock(block.id)}
                    onPointerLeave={() => runtime.leaveBlock(block.id)}
                    onClick={clickable ? () => runtime.clickBlock(block.id) : undefined}
                    onDoubleClick={() => runtime.doubleClickBlock(block.id)}
                  >
                    <BlockFx emphasis={stateStyle?.emphasis ?? block.emphasis}>
                      <div style={{ width: '100%', height: '100%', ...shadowStyle(block) }}>
                        <def.Runtime block={block} runtime={runtime} stateStyle={stateStyle} t={hasTimeline ? t : undefined} tState={tState} />
                      </div>
                    </BlockFx>
                  </div>
                );
              })}
            </div>
          ) : null
        )}
        <button type="button" className="player-lightbox-close" aria-label="Close" onClick={() => runtime.closeLightbox()}>
          <Lucide name="x" size={18} />
        </button>
      </div>
    </div>
  );
}
