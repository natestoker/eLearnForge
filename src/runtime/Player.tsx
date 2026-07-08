import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Project } from '../schema/types';
import { Runtime } from '../engine/runtime';
import { BLOCKS } from '../blocks/registry';
import { blockStateAt, styleFor, timelineDuration } from '../engine/timeline';
import { TimelineClock } from './TimelineClock';
import { TimedMedia } from './TimedMedia';
import { PlayerNavButtons, PlayerSideNav } from './PlayerChrome';
import { accessibilityFor } from './accessibility';
import { runEmphasis } from '../blocks/emphasis';
import type { Emphasis } from '../blocks/emphasis';
import { gsap } from 'gsap';
import type { StateStyle } from '../schema/types';
import { defaultPlayerSettings } from '../schema/factory';
import { ensureFont, ensureEmbeddedFonts } from '../shared/fonts';
import { shadowStyle } from '../shared/shadow';

// Standalone runtime module (per brief): takes Project JSON plus a variable
// store, renders current slide/layer/block state, wires triggers, re-renders
// on state change. No SCORM wrapper in v1; this is where it bolts on later.

import type { TrackingAdapter } from '../tracking/adapter';

export function Player({ project, adapter, startSlideId }: {
  project: Project;
  adapter?: TrackingAdapter;
  startSlideId?: string;
}) {
  const runtime = useMemo(() => {
    const rt = new Runtime(project);
    if (startSlideId && project.slides.some((s) => s.id === startSlideId)) {
      rt.enterSlide(startSlideId);
    }
    return rt;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Make the course's fonts available: Google families and any typefaces
  // embedded from an imported PowerPoint.
  useEffect(() => {
    (project.fonts ?? []).forEach((f) => ensureFont(f));
    ensureEmbeddedFonts(project.embeddedFonts);
  }, [project.fonts, project.embeddedFonts]);

  // Tracking wiring lives here, once, regardless of publish target.
  useEffect(() => {
    if (!adapter) return;
    // Order matters: initialize first (it writes baseline status like
    // 'incomplete'), then subscribe (flushes buffered construction events,
    // which may include 'completed'), then restore position.
    const resume = adapter.initialize(project.title);
    const off = runtime.onTrack((e) => adapter.handle(e));
    if (resume) runtime.restoreState(resume);
    const save = () => adapter.saveResume(runtime.getResumeState());
    const onVis = () => { if (document.visibilityState === 'hidden') save(); };
    const onHide = () => { save(); adapter.terminate(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, adapter]);
  useSyncExternalStore(runtime.subscribe, runtime.getVersion, runtime.getVersion);

  const slide = runtime.currentSlide();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = stageAreaRef.current;
    if (!el) return;
    const measure = () => {
      const pad = 32;
      const s = Math.min(
        (el.clientWidth - pad) / slide.width,
        (el.clientHeight - pad) / slide.height
      );
      setScale(Math.max(0.1, Math.min(s, 2)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slide.width, slide.height]);

  const slideIndex = project.slides.findIndex((s) => s.id === slide.id);

  // Timeline clock: one per slide visit. Narration audio drives the time
  // when present; otherwise requestAnimationFrame does. t flows down into
  // the stateless per-block state math, so scrubbing is always safe.
  const allBlocks = slide.layers.flatMap((l) => l.blocks);
  const configuredDuration = timelineDuration(slide.timeline, allBlocks);
  const hasTimeline = configuredDuration > 0;
  // Narration metadata overrides the configured duration once it loads.
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const duration = audioDuration ?? configuredDuration;
  const [t, setT] = useState(0);
  const timedMediaRef = useRef<TimedMedia>(new TimedMedia());
  const clockRef = useRef<TimelineClock | null>(null);
  const pulseRef = useRef<Map<string, () => void>>(new Map());

  // Handle trigger actions that touch live player objects: audio playback,
  // the timeline clock, and one-shot emphasis pulses.
  useEffect(() => {
    return runtime.onEffect((action) => {
      if (action.type === 'playAudio' || action.type === 'pauseAudio') {
        const el = document.querySelector(`[data-block-id="${action.blockId}"] audio`) as HTMLAudioElement | null;
        if (el) { if (action.type === 'playAudio') el.play().catch(() => {}); else el.pause(); }
      } else if (action.type === 'pauseTimeline') {
        clockRef.current?.pause();
      } else if (action.type === 'resumeTimeline') {
        clockRef.current?.play();
      } else if (action.type === 'seekTimeline') {
        clockRef.current?.seek(action.seconds);
      } else if (action.type === 'restartTimeline') {
        clockRef.current?.seek(0);
        clockRef.current?.play();
      } else if (action.type === 'pulseBlock') {
        const el = document.querySelector(`[data-block-id="${action.blockId}"] .block-fx`) as HTMLElement | null;
        if (el) {
          pulseRef.current.get(action.blockId)?.();
          const stop = runEmphasis(el, action.emphasis);
          pulseRef.current.set(action.blockId, stop);
          // Auto-stop a one-shot pulse after a moment.
          window.setTimeout(() => { stop(); pulseRef.current.delete(action.blockId); }, 1600);
        }
      }
    });
  }, [runtime]);
  const prevTRef = useRef(0);
  const stageAnimRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [downId, setDownId] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setT(0);
    prevTRef.current = 0;
    setAudioDuration(null);
    clockRef.current?.dispose();
    clockRef.current = null;
    if (!hasTimeline) return;
    timedMediaRef.current.reset();
    const clock = new TimelineClock({
      duration: configuredDuration,
      onDuration: setAudioDuration,
      narrationSrc: slide.timeline?.narrationSrc,
      onTick: (tt) => {
        const prev = prevTRef.current;
        prevTRef.current = tt;
        setT(tt);
        timedMediaRef.current.sync(tt, clockRef.current?.isPlaying ?? true);
        // Threshold crossings feed the onBlockEnters / onAnimationComplete
        // trigger events. Forward motion only; scrubbing back re-arms them.
        if (tt > prev) {
          const entered: string[] = [];
          const animDone: string[] = [];
          for (const bl of allBlocks) {
            if (!bl.timing) continue;
            const s = bl.timing.start;
            if (prev < s && tt >= s) entered.push(bl.id);
            const aIn = bl.timing.animIn;
            if (aIn && aIn.type !== 'none') {
              const done = s + aIn.duration;
              if (prev < done && tt >= done) animDone.push(bl.id);
            }
          }
          const cues = (slide.timeline?.cues ?? []).filter((c) => prev < c.time && tt >= c.time).map((c) => c.id);
          runtime.timelineCrossings(entered, animDone, cues);
        }
      },
      onPlayState: (pl) => {
        setPlaying(pl);
        timedMediaRef.current.sync(clockRef.current?.time ?? 0, pl);
      },
      onEnd: () => {
        runtime.timelineEnded();
        if (slide.timeline?.autoAdvance) {
          const next = project.slides[slideIndex + 1];
          if (next) runtime.enterSlide(next.id);
        }
      }
    });
    clockRef.current = clock;
    clock.play();
    return () => clock.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id, hasTimeline]);

  // GSAP slide transition: animate the stage in whenever the slide changes.
  useEffect(() => {
    const el = stageAnimRef.current;
    const kind = project.slideTransition ?? 'none';
    if (!el || kind === 'none') return;
    if (kind === 'fade') gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' });
    else if (kind === 'slide') gsap.fromTo(el, { xPercent: 4, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' });
    else if (kind === 'slideLeft') gsap.fromTo(el, { xPercent: 8, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
    else if (kind === 'slideRight') gsap.fromTo(el, { xPercent: -8, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
    else if (kind === 'slideUp') gsap.fromTo(el, { yPercent: 8, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
    else if (kind === 'zoom') gsap.fromTo(el, { scale: 0.96, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'power2.out', transformOrigin: 'center' });
    else if (kind === 'zoomOut') gsap.fromTo(el, { scale: 1.06, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'power2.out', transformOrigin: 'center' });
    else if (kind === 'flip') gsap.fromTo(el, { rotationY: 90, autoAlpha: 0 }, { rotationY: 0, autoAlpha: 1, duration: 0.55, ease: 'power3.out', transformOrigin: 'center', transformPerspective: 900 });
  }, [slide.id, project.slideTransition]);

  const settings = project.player ?? defaultPlayerSettings();
  const playerAccent = settings.accent ?? project.theme?.accent ?? '#3ddc97';
  const chromeClass =
    `player chrome-${settings.chrome ?? 'dark'} btn-shape-${settings.buttonShape ?? 'rounded'} btn-fill-${settings.buttonStyle ?? 'solid'}` +
    ` btnfx-hover-${settings.buttonHover ?? 'none'} btnfx-emph-${settings.buttonEmphasis ?? 'none'}`;

  return (
    <div className={chromeClass} ref={containerRef} style={{ ['--player-accent' as string]: playerAccent }}>
      <div className="player-body">
        {/* Navigation sidebar: hamburger-toggled, animates its width, and
            navOpen persists for the whole run (state lives on Player, which
            never remounts between slides). */}
        <aside className={`player-sidenav ${navOpen ? 'open' : ''}`} aria-hidden={!navOpen}>
          <PlayerSideNav
            runtime={runtime}
            project={project}
            slideIndex={slideIndex}
            settings={settings}
          />
        </aside>
        <div className="player-main">
          <button
            className="player-hamburger"
            aria-label={navOpen ? 'Hide navigation' : 'Show navigation'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
          {settings.titlePosition === 'top' && (
            <div className="player-titlebar">
              <span className="player-titlebar-title">{project.title}</span>
              <span className="player-titlebar-slide">{slide.name} ({slideIndex + 1}/{project.slides.length})</span>
            </div>
          )}
          <div className="player-stage-area" ref={stageAreaRef}>
        <div
          className="player-stage"
          ref={stageAnimRef}
          style={{
            width: slide.width,
            height: slide.height,
            transform: `scale(${scale})`
          }}
        >
        {slide.layers.map((layer) =>
          runtime.isLayerVisible(layer.id) ? (
            <div key={layer.id} className="player-layer">
              {layer.blocks.map((block) => {
                if (!runtime.isBlockVisible(block.id)) return null;
                const def = BLOCKS[block.type];
                const pState = runtime.getBlockState(block.id);
                if (pState === 'hidden') return null;
                const disabled = pState === 'disabled';
                const acc = accessibilityFor(block);
                const clickable = !disabled && (runtime.blockHasInteractionTrigger(block.id) || Boolean(block.stateStyles?.selected || block.stateStyles?.visited));
                const tState = hasTimeline ? blockStateAt(t, block.timing, duration, block.motion) : null;
                const attachedAudio = block.audio?.src;
                const timedMedia = hasTimeline && block.timing &&
                  (block.type === 'audio' || block.type === 'video' || Boolean(attachedAudio));
                // Effective style: persistent state first, transient pointer
                // states layered on top when interactive.
                let stateStyle: StateStyle | undefined =
                  pState !== 'normal' ? block.stateStyles?.[pState as 'selected' | 'visited' | 'disabled'] : undefined;
                if (clickable && downId === block.id && block.stateStyles?.down) stateStyle = block.stateStyles.down;
                else if (clickable && hoverId === block.id && block.stateStyles?.hover && pState === 'normal') stateStyle = block.stateStyles.hover;
                return (
                  <div
                    key={block.id}
                    data-block-id={block.id}
                    className={`player-block ${clickable ? 'clickable' : ''}`}
                    style={{
                      left: block.x, top: block.y, width: block.w, height: block.h,
                      ...(tState ? styleFor(tState) : {}),
                      ...(stateStyle?.opacity !== undefined ? { opacity: stateStyle.opacity } : {}),
                      ...(disabled ? { cursor: 'default' } : {})
                    }}
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? 'button' : undefined}
                    aria-disabled={disabled || undefined}
                    aria-hidden={acc.hidden || undefined}
                    aria-label={acc.label}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              runtime.clickBlock(block.id);
                            }
                          }
                        : undefined
                    }
                    onPointerEnter={() => { setHoverId(block.id); runtime.hoverBlock(block.id); }}
                    onPointerLeave={() => { setHoverId((h) => (h === block.id ? null : h)); setDownId((d) => (d === block.id ? null : d)); runtime.leaveBlock(block.id); }}
                    onPointerDown={() => clickable && setDownId(block.id)}
                    onPointerUp={() => setDownId((d) => (d === block.id ? null : d))}
                    onClick={clickable ? () => runtime.clickBlock(block.id) : undefined}
                    onDoubleClick={() => runtime.doubleClickBlock(block.id)}
                  >
                    {/* FX layer: GSAP emphasis writes transform HERE, on an
                        element React does not re-style every tick, so the
                        timeline transform on the wrapper never fights it. */}
                    <BlockFx emphasis={block.emphasis}>
                      <div
                        style={{ width: '100%', height: '100%', ...shadowStyle(block) }}
                        ref={(el) => {
                          if (timedMedia) {
                            timedMediaRef.current.register(
                              block.id,
                              el?.querySelector('audio, video') ?? null,
                              block.timing!.start
                            );
                          }
                        }}
                      >
                        <def.Runtime block={block} runtime={runtime} stateStyle={stateStyle} t={hasTimeline ? t : undefined} tState={tState} />
                        {/* Block-attached audio (Add/Bake audio) rides the
                            same pipeline as audio blocks: TimedMedia drives
                            it when the block has a timeline bar; otherwise it
                            plays when the block appears. playAudio triggers
                            find it via the data-block-id query above. */}
                        {attachedAudio && (
                          <audio src={attachedAudio} preload="auto" autoPlay={!timedMedia} style={{ display: 'none' }} />
                        )}
                      </div>
                    </BlockFx>
                  </div>
                );
              })}
            </div>
          ) : null
        )}
      </div>
      </div>
          <div className="player-chrome-bar slim">
            {settings.progressBar && (
              <div className="player-course-progress" title={`Slide ${slideIndex + 1} of ${project.slides.length}`}>
                <div className="player-course-progress-fill" style={{ width: `${((slideIndex + 1) / project.slides.length) * 100}%` }} />
              </div>
            )}
            {(settings.navPosition ?? 'right') === 'left' && (
              <PlayerNavButtons runtime={runtime} project={project} slideIndex={slideIndex} settings={settings} />
            )}
            {hasTimeline && (
              <div className="player-controls">
                <button
                  className="player-play"
                  onClick={() => (playing ? clockRef.current?.pause() : clockRef.current?.play())}
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  {playing ? '||' : '>'}
                </button>
                <input
                  className="player-seek"
                  type="range"
                  min={0}
                  max={duration}
                  step={0.05}
                  value={Math.min(t, duration)}
                  onChange={(e) => clockRef.current?.seek(Number(e.target.value))}
                />
                <span className="player-time">
                  {t.toFixed(1)}s / {duration.toFixed(1)}s
                </span>
              </div>
            )}
            {(settings.titlePosition ?? 'bottom') === 'bottom' && (
              <div className="player-hud">
                <span className="player-hud-title">{project.title}</span>
                <span className="player-hud-slide">
                  {slide.name} ({slideIndex + 1}/{project.slides.length})
                </span>
              </div>
            )}
            {(settings.navPosition ?? 'right') === 'right' && (
              <div style={{ marginLeft: 'auto' }}>
                <PlayerNavButtons runtime={runtime} project={project} slideIndex={slideIndex} settings={settings} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// A stable inner layer for looping GSAP emphasis. Because React never sets a
// transform on this element, GSAP owns it outright - the timeline transform
// lives on the parent .player-block, so the two never overwrite each other.
function BlockFx({ emphasis, children }: { emphasis?: Emphasis; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && emphasis && emphasis !== 'none') {
      return runEmphasis(ref.current, emphasis);
    }
  }, [emphasis]);
  return (
    <div ref={ref} className="block-fx" style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}
