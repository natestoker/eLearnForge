import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Project } from '../schema/types';
import { Runtime } from '../engine/runtime';
import { BLOCKS } from '../blocks/registry';
import { blockStateAt, styleFor, timelineDuration } from '../engine/timeline';
import { motionOffsetAt } from '../engine/motionPath';
import { slideBackgroundStyle } from '../shared/background';
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
import { parseVtt, cueAt } from './captions';

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
      const pad = window.innerWidth < 640 ? 8 : 32;
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
  const motionTweenRef = useRef<Map<string, gsap.core.Tween>>(new Map());
  // Slide-clock time each non-base layer was revealed at (its clock's zero).
  const layerRevealRef = useRef<Map<string, number>>(new Map());
  // Own-timeline layers: a second clock drives the ACTIVE layer (topmost
  // visible layer with layer.timeline). While it runs, the chrome seekbar and
  // play button control it, and its media sync against it.
  const layerClockRef = useRef<TimelineClock | null>(null);
  const layerMediaRef = useRef<TimedMedia>(new TimedMedia());
  const pausedBaseRef = useRef(false);
  const [layerT, setLayerT] = useState(0);
  const [layerPlaying, setLayerPlaying] = useState(false);
  const [layerDuration, setLayerDuration] = useState(0);
  // Find a block anywhere in the course by id (motion lookup for playMotion).
  const findBlockOnSlide = (id: string) => {
    const walk = (blocks: typeof project.slides[number]['layers'][number]['blocks']): (typeof blocks)[number] | undefined => {
      for (const b of blocks) {
        if (b.id === id) return b;
        const kids = (b as { children?: typeof blocks }).children;
        if (kids) { const f = walk(kids); if (f) return f; }
      }
      return undefined;
    };
    for (const s of project.slides) for (const l of s.layers) { const f = walk(l.blocks); if (f) return f; }
    return undefined;
  };

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
      } else if (action.type === 'playMotion') {
        // Send the block travelling along its path now. Only meaningful for a
        // trigger-driven motion (auto motion already moves on the clock). We
        // tween the FX layer so it composes with the wrapper's timeline state,
        // linearly, letting motionOffsetAt apply the path's own easing.
        const blk = findBlockOnSlide(action.blockId);
        const el = document.querySelector(`[data-block-id="${action.blockId}"] .block-fx`) as HTMLElement | null;
        if (blk?.motion && el) {
          const m = blk.motion;
          const easeFn = gsap.parseEase(m.ease) ?? ((n: number) => n);
          motionTweenRef.current.get(action.blockId)?.kill();
          const proxy = { p: 0 };
          const tw = gsap.to(proxy, {
            p: 1, duration: Math.max(0.05, m.duration), ease: 'none',
            repeat: m.loop ? -1 : 0,
            onUpdate: () => {
              const off = motionOffsetAt(m, m.start + proxy.p * m.duration, easeFn);
              gsap.set(el, { x: off.x, y: off.y });
            }
          });
          motionTweenRef.current.set(action.blockId, tw);
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
  const [ccOn, setCcOn] = useState(true);
  const [infoPanel, setInfoPanel] = useState<'resources' | 'glossary' | null>(null);
  // For buttonEmphasisTrigger === 'timelineEnd': a slide with no timeline has
  // nothing to wait for, so it counts as already "ended".
  const [timelineEnded, setTimelineEnded] = useState(!hasTimeline);
  const resources = project.resources ?? [];
  const glossary = project.glossary ?? [];

  // Captions for the current slide (auto-baked from narration, or authored).
  const cues = useMemo(() => parseVtt(slide.timeline?.captionsVtt), [slide.timeline?.captionsVtt]);
  const activeCue = ccOn && cues.length ? cueAt(cues, t) : null;

  useEffect(() => {
    setT(0);
    prevTRef.current = 0;
    setAudioDuration(null);
    setTimelineEnded(!hasTimeline);
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
        setTimelineEnded(true);
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
  // A slide's own `transition` overrides the course-wide default when set -
  // the general slide-overrides-global pattern (same as slideTransition
  // itself being the fallback for everything else).
  const effectiveTransition = slide.transition ?? project.slideTransition ?? 'none';
  // New slide: forget layer reveal times so its layers start fresh clocks.
  useEffect(() => { layerRevealRef.current.clear(); }, [slide.id]);

  // The ACTIVE own-timeline layer: the topmost visible layer that has one.
  // Its clock starts at 0 when it appears; the chrome seekbar/play button
  // drive it while it's up; layer.pauseBase freezes the base clock meanwhile.
  const activeTlLayer =
    [...slide.layers].reverse().find((l) => l.id !== slide.layers[0]?.id && l.timeline && runtime.isLayerVisible(l.id)) ?? null;
  const activeTlLayerId = activeTlLayer?.id ?? null;

  useEffect(() => {
    layerClockRef.current?.dispose();
    layerClockRef.current = null;
    layerMediaRef.current.reset();
    setLayerT(0);
    setLayerPlaying(false);
    if (!activeTlLayerId) {
      // Layer closed: resume the base timeline if we paused it.
      if (pausedBaseRef.current) { clockRef.current?.play(); pausedBaseRef.current = false; }
      return;
    }
    const layer = slide.layers.find((l) => l.id === activeTlLayerId);
    const lt = layer?.timeline;
    if (!layer || !lt) return;
    if (layer.pauseBase && clockRef.current?.isPlaying) {
      clockRef.current.pause();
      pausedBaseRef.current = true;
    }
    const clock = new TimelineClock({
      duration: Math.max(1, lt.duration || 1),
      narrationSrc: lt.narrationSrc,
      onTick: (tt) => { setLayerT(tt); layerMediaRef.current.sync(tt, layerClockRef.current?.isPlaying ?? true); },
      onPlayState: (pl) => { setLayerPlaying(pl); layerMediaRef.current.sync(layerClockRef.current?.time ?? 0, pl); },
      onEnd: () => { /* the layer stays up at its end frame until hidden */ },
      onDuration: (d) => setLayerDuration(d)
    });
    layerClockRef.current = clock;
    setLayerDuration(Math.max(1, lt.duration || 1));
    clock.play();
    return () => { clock.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTlLayerId, slide.id]);

  useEffect(() => {
    const el = stageAnimRef.current;
    const kind = effectiveTransition;
    if (!el || kind === 'none') return;
    if (kind === 'fade') gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' });
    else if (kind === 'slide') gsap.fromTo(el, { xPercent: 4, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' });
    else if (kind === 'slideLeft') gsap.fromTo(el, { xPercent: 8, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
    else if (kind === 'slideRight') gsap.fromTo(el, { xPercent: -8, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
    else if (kind === 'slideUp') gsap.fromTo(el, { yPercent: 8, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' });
    else if (kind === 'zoom') gsap.fromTo(el, { scale: 0.96, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'power2.out', transformOrigin: 'center' });
    else if (kind === 'zoomOut') gsap.fromTo(el, { scale: 1.06, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'power2.out', transformOrigin: 'center' });
    else if (kind === 'flip') gsap.fromTo(el, { rotationY: 90, autoAlpha: 0 }, { rotationY: 0, autoAlpha: 1, duration: 0.55, ease: 'power3.out', transformOrigin: 'center', transformPerspective: 900 });
    // Page flip: pivots on the LEFT edge (the spine), like a page turning.
    // A tight perspective (vs. the ~900-1600 used elsewhere) is what makes
    // the rotation actually foreshorten into a curl instead of reading as a
    // flat card spinning - the closer the vanishing point, the more the far
    // edge visibly narrows and bends as it rotates. Four keyframes trace the
    // profile of a real page: it lifts off the spine (heavy skew, near
    // edge-on, dark - angled away from the light), arcs through edge-on at
    // its most extreme narrow/dark point, then opens back up and flattens
    // with a little overshoot instead of snapping flat. A soft moving shadow
    // riding along the curling edge (a temporary overlay, removed after) is
    // what actually sells "paper" - the transform alone still reads as
    // plastic without it.
    else if (kind === 'pageFlip') {
      // The vanishing point has to sit AT the spine (the same point the page
      // rotates around), not at the element's own center - otherwise a wide
      // slide rotating around its left edge swings its far (right) edge
      // behind the camera's near plane and the whole thing clips to
      // nothing mid-turn. GSAP's per-element transformPerspective always
      // centers on the element, so the true CSS `perspective` +
      // `perspective-origin` has to go on the parent stage area instead.
      const area = stageAreaRef.current;
      gsap.set(el, { transformOrigin: 'left center' });
      if (area) gsap.set(area, { perspective: 900, perspectiveOrigin: '0% 50%' });
      const shade = document.createElement('div');
      shade.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;opacity:0;background:linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0) 65%);';
      el.appendChild(shade);
      gsap.timeline({
        onComplete: () => { shade.remove(); if (area) gsap.set(area, { clearProps: 'perspective,perspectiveOrigin' }); },
      })
        .set(el, { rotationY: -78, scaleX: 0.5, skewY: 30, autoAlpha: 0.4, filter: 'brightness(0.45)' })
        .to(shade, { opacity: 1, duration: 0.001 }, 0)
        .to(el, { rotationY: -45, scaleX: 0.7, skewY: 18, autoAlpha: 0.7, filter: 'brightness(0.6)', duration: 0.22, ease: 'power1.in' })
        .to(el, { rotationY: -15, scaleX: 0.9, skewY: 6, autoAlpha: 0.92, filter: 'brightness(0.85)', duration: 0.22, ease: 'power1.out' })
        .to([el, shade], { rotationY: 0, scaleX: 1, skewY: 0, autoAlpha: 1, filter: 'brightness(1)', opacity: 0, duration: 0.26, ease: 'back.out(1.7)' })
        .set(el, { clearProps: 'transform,filter' });
    }
  }, [slide.id, effectiveTransition]);

  const settings = project.player ?? defaultPlayerSettings();
  const playerAccent = settings.accent ?? project.theme?.accent ?? '#3ddc97';
  // Whether the Next/Submit emphasis animation is actually allowed to run
  // right now. 'always' (or unset) matches the old always-on behavior;
  // 'timelineEnd' waits for this slide's clock to finish; 'variable' checks
  // a course-variable condition live (re-evaluated on every runtime change,
  // since useSyncExternalStore above already re-renders this component then).
  const emphasisTrigger = settings.buttonEmphasisTrigger ?? 'always';
  const emphasisActive =
    emphasisTrigger === 'timelineEnd' ? timelineEnded
    : emphasisTrigger === 'variable' ? Boolean(settings.buttonEmphasisCondition && runtime.checkCondition(settings.buttonEmphasisCondition))
    : true;
  const chromeClass =
    `player chrome-${settings.chrome ?? 'dark'} btn-shape-${settings.buttonShape ?? 'rounded'} btn-fill-${settings.buttonStyle ?? 'solid'}` +
    ` btnfx-hover-${settings.buttonHover ?? 'none'} btnfx-emph-${emphasisActive ? (settings.buttonEmphasis ?? 'none') : 'none'}`;

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
          {(resources.length > 0 || glossary.length > 0) && (
            <div className="player-info-tabs">
              {resources.length > 0 && (
                <button className="player-info-btn" onClick={() => setInfoPanel((v) => (v === 'resources' ? null : 'resources'))} aria-pressed={infoPanel === 'resources'}>
                  Resources
                </button>
              )}
              {glossary.length > 0 && (
                <button className="player-info-btn" onClick={() => setInfoPanel((v) => (v === 'glossary' ? null : 'glossary'))} aria-pressed={infoPanel === 'glossary'}>
                  Glossary
                </button>
              )}
            </div>
          )}
          {infoPanel && (
            <div className="player-info-panel" role="dialog" aria-label={infoPanel}>
              <div className="player-info-panel-head">
                <span>{infoPanel === 'resources' ? 'Resources' : 'Glossary'}</span>
                <button className="player-info-close" aria-label="Close" onClick={() => setInfoPanel(null)}>×</button>
              </div>
              <div className="player-info-panel-body">
                {infoPanel === 'resources' && resources.map((r) => (
                  <a key={r.id} className="player-resource" href={r.url || undefined} target="_blank" rel="noopener noreferrer" download={r.url.startsWith('data:') ? r.title : undefined}>
                    <span className="player-resource-title">{r.title}</span>
                    {r.description && <span className="player-resource-desc">{r.description}</span>}
                  </a>
                ))}
                {infoPanel === 'glossary' && glossary.map((g) => (
                  <div key={g.id} className="player-glossary-term">
                    <div className="player-glossary-word">{g.term}</div>
                    <div className="player-glossary-def">{g.definition}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            transform: `scale(${scale})`,
            ...slideBackgroundStyle(slide.background)
          }}
        >
        {slide.layers.map((layer, layerIndex) => {
          const layerVisible = runtime.isLayerVisible(layer.id);
          // Layers have their own clock, Storyline-style: it starts the moment
          // the layer is revealed (a hidden layer shown by a hotspot at t=5
          // plays its entrances THEN, not "already played at t=0"). Track the
          // reveal time per layer; hiding a layer resets it, so re-showing
          // replays its animations. The base layer stays on the slide clock.
          const reveals = layerRevealRef.current;
          if (layerIndex > 0) {
            if (layerVisible && !reveals.has(layer.id)) reveals.set(layer.id, layer.visibleByDefault ? 0 : t);
            else if (!layerVisible && reveals.has(layer.id)) reveals.delete(layer.id);
          }
          // Three clocks a layer can be on: the base slide clock (base layer),
          // its OWN TimelineClock (layer.timeline; the active one ticks, others
          // hold at 0), or the reveal-offset shim (plain layers).
          const ownTl = layerIndex > 0 ? layer.timeline : undefined;
          const layerClockT = ownTl
            ? (layer.id === activeTlLayerId ? layerT : 0)
            : layerIndex === 0 ? t : Math.max(0, t - (reveals.get(layer.id) ?? 0));
          const layerDur = ownTl
            ? Math.max(layer.id === activeTlLayerId ? layerDuration : 0, ownTl.duration || 1)
            : duration;
          return layerVisible ? (
            <div key={layer.id} className="player-layer">
              {layer.blocks.map((block) => {
                if (!runtime.isBlockVisible(block.id)) return null;
                const def = BLOCKS[block.type];
                const pState = runtime.getBlockState(block.id);
                if (pState === 'hidden') return null;
                const disabled = pState === 'disabled';
                const acc = accessibilityFor(block);
                const clickable = !disabled && (runtime.blockHasInteractionTrigger(block.id) || Boolean(block.stateStyles?.selected || block.stateStyles?.visited));
                const tState = hasTimeline || ownTl ? blockStateAt(layerClockT, block.timing, layerDur, block.motion) : null;
                const attachedAudio = block.audio?.src;
                const timedMedia = (hasTimeline || ownTl) && block.timing &&
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
                    <BlockFx emphasis={stateStyle?.emphasis ?? block.emphasis}>
                      <div
                        style={{ width: '100%', height: '100%', ...shadowStyle(block) }}
                        ref={(el) => {
                          if (timedMedia) {
                            // Media on an own-timeline layer syncs to the
                            // LAYER clock, not the base one.
                            (ownTl ? layerMediaRef : timedMediaRef).current.register(
                              block.id,
                              el?.querySelector('audio, video') ?? null,
                              block.timing!.start
                            );
                          }
                        }}
                      >
                        <def.Runtime block={block} runtime={runtime} stateStyle={stateStyle} t={hasTimeline || ownTl ? layerClockT : undefined} tState={tState} />
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
          ) : null;
        })}
      </div>
      {activeCue && (
        <div className="player-captions" aria-live="polite">
          <span>{activeCue.text}</span>
        </div>
      )}
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
            {(hasTimeline || activeTlLayerId) && (() => {
              // While an own-timeline layer is up, the transport reflects and
              // controls THAT layer's clock (Storyline behavior); otherwise
              // the base slide timeline.
              const onLayer = Boolean(activeTlLayerId);
              const uiT = onLayer ? layerT : t;
              const uiDur = onLayer ? Math.max(0.1, layerDuration) : duration;
              const uiPlaying = onLayer ? layerPlaying : playing;
              const uiClock = () => (onLayer ? layerClockRef.current : clockRef.current);
              return (
              <div className="player-controls">
                {onLayer && (
                  <span className="player-layer-chip" title="The seekbar is on this layer's timeline while the layer is open">
                    ⏱ {activeTlLayer!.name}
                  </span>
                )}
                <button
                  className="player-play"
                  onClick={() => (uiPlaying ? uiClock()?.pause() : uiClock()?.play())}
                  aria-label={uiPlaying ? 'Pause' : 'Play'}
                >
                  {uiPlaying ? '||' : '>'}
                </button>
                <input
                  className="player-seek"
                  type="range"
                  min={0}
                  max={uiDur}
                  step={0.05}
                  value={Math.min(uiT, uiDur)}
                  onChange={(e) => uiClock()?.seek(Number(e.target.value))}
                />
                <span className="player-time">
                  {uiT.toFixed(1)}s / {uiDur.toFixed(1)}s
                </span>
                {(settings.captionsButton ?? true) && cues.length > 0 && (
                  <button
                    className={`player-cc ${ccOn ? 'on' : ''}`}
                    onClick={() => setCcOn((c) => !c)}
                    aria-pressed={ccOn}
                    title={ccOn ? 'Hide captions' : 'Show captions'}
                  >
                    CC
                  </button>
                )}
              </div>
              );
            })()}
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
