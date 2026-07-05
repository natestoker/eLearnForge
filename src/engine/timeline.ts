import gsap from 'gsap';
import type { AnimSpec, Block, BlockTiming, SlideTimeline } from '../schema/types';

// Stateless timeline math. The visual state of every block is a pure
// function of the current time t - the same discipline as the proven
// Storyline seekbar work: no stateful tweens to fight, scrubbing in either
// direction is just recomputing. GSAP supplies the easing curves; React
// applies the resulting style.

export interface BlockVisualState {
  present: boolean;   // inside its window at all (pointer-events off when not)
  opacity: number;
  translateX: number; // px
  translateY: number;
  scale: number;
  rotate: number;     // deg (spin/pop)
  rotateX: number;    // deg (flipX)
  rotateY: number;    // deg (flipY)
  clipTop: number;    // 0..1 fraction hidden from the top (wipe)
}

const OFFSET = 40; // px travel for slide-in/out presets

const easeCache = new Map<string, (n: number) => number>();
function easeFn(name: string): (n: number) => number {
  let fn = easeCache.get(name);
  if (!fn) {
    fn = gsap.parseEase(name || 'power2.out') ?? ((n: number) => n);
    easeCache.set(name, fn);
  }
  return fn;
}

function animOffsets(spec: AnimSpec, p: number, entering: boolean): Partial<BlockVisualState> {
  // p is eased progress 0..1 of the animation. Entering animations run
  // from offset -> rest; exit animations run rest -> offset.
  const k = entering ? 1 - p : p;
  switch (spec.type) {
    case 'fade': return { opacity: 1 - k };
    case 'slideUp': return { opacity: 1 - k, translateY: OFFSET * k };
    case 'slideDown': return { opacity: 1 - k, translateY: -OFFSET * k };
    case 'slideLeft': return { opacity: 1 - k, translateX: OFFSET * k };
    case 'slideRight': return { opacity: 1 - k, translateX: -OFFSET * k };
    case 'zoom': return { opacity: 1 - k, scale: 1 - 0.35 * k };
    case 'zoomOut': return { opacity: 1 - k, scale: 1 + 0.4 * k };
    case 'spin': return { opacity: 1 - k, rotate: -180 * k, scale: 1 - 0.3 * k };
    case 'flipX': return { opacity: 1 - k, rotateX: 90 * k };
    case 'flipY': return { opacity: 1 - k, rotateY: 90 * k };
    case 'bounceIn': return { opacity: 1 - Math.min(1, k * 2), scale: 1 - 0.6 * k, translateY: -30 * k };
    case 'wipeUp': return { clipTop: k, translateY: 8 * k };
    case 'popRotate': return { opacity: 1 - k, scale: 1 - 0.5 * k, rotate: 12 * k };
    default: return {};
  }
}

const REST: BlockVisualState = { present: true, opacity: 1, translateX: 0, translateY: 0, scale: 1, rotate: 0, rotateX: 0, rotateY: 0, clipTop: 0 };

export function blockStateAt(t: number, timing: BlockTiming | undefined, timelineEnd: number): BlockVisualState {
  if (!timing) return REST;
  const start = timing.start ?? 0;
  const end = timing.end ?? timelineEnd;

  if (t < start || t > end) {
    return { present: false, opacity: 0, translateX: 0, translateY: 0, scale: 1, rotate: 0, rotateX: 0, rotateY: 0, clipTop: 0 };
  }

  let state = { ...REST };

  const aIn = timing.animIn;
  if (aIn && aIn.type !== 'none' && aIn.duration > 0) {
    const p = Math.min(1, (t - start) / aIn.duration);
    Object.assign(state, animOffsets(aIn, easeFn(aIn.ease)(p), true));
  }

  const aOut = timing.animOut;
  if (aOut && aOut.type !== 'none' && aOut.duration > 0 && timing.end !== undefined) {
    const outStart = end - aOut.duration;
    if (t >= outStart) {
      const p = Math.min(1, (t - outStart) / aOut.duration);
      Object.assign(state, animOffsets(aOut, easeFn(aOut.ease)(p), false));
    }
  }

  return state;
}

export function timelineDuration(timeline: SlideTimeline | undefined, blocks: Block[]): number {
  if (!timeline) return 0;
  // Blocks scheduled past the set duration extend it so nothing is cut off.
  let d = Math.max(1, timeline.duration || 0);
  for (const b of blocks) {
    if (b.timing?.end !== undefined) d = Math.max(d, b.timing.end);
    else if (b.timing) d = Math.max(d, b.timing.start + 1);
  }
  return d;
}

export function styleFor(state: BlockVisualState): React.CSSProperties {
  return {
    opacity: state.opacity,
    transform:
      `translate(${state.translateX}px, ${state.translateY}px)` +
      ` scale(${state.scale})` +
      (state.rotate ? ` rotate(${state.rotate}deg)` : '') +
      (state.rotateX ? ` rotateX(${state.rotateX}deg)` : '') +
      (state.rotateY ? ` rotateY(${state.rotateY}deg)` : ''),
    perspective: 600,
    clipPath: state.clipTop ? `inset(${state.clipTop * 100}% 0 0 0)` : undefined,
    pointerEvents: state.present ? undefined : 'none',
    visibility: state.present ? undefined : 'hidden'
  };
}
