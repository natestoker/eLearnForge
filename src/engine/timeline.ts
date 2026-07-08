import gsap from 'gsap';
import type { AnimDirection, AnimSpec, AnimType, Block, BlockTiming, MotionPath, SlideTimeline } from '../schema/types';
import { motionOffsetAt } from './motionPath';

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
  scaleX: number;     // stretch
  scaleY: number;     // collapse
  rotate: number;     // deg (spin/pop)
  rotateX: number;    // deg (flip up/down)
  rotateY: number;    // deg (flip left/right)
  // Wipe reveal: fraction hidden from each side (0..1). Rendered as a
  // clip-path inset; non-wiped sides get a negative inset so overflowing
  // geometry (callout tails, line arrowheads) is never chopped.
  clip: { top: number; right: number; bottom: number; left: number } | null;
}

const SLIDE_DISTANCE = 40;  // px default travel for slide
const RISE_DISTANCE = 160;  // px default travel for rise (PowerPoint-scale)

// One animation per effect; direction/distance are options. Projects saved
// before the consolidation stored per-direction types (slideUp, wipeUp,
// flipX...) - map them onto the consolidated form on read.
export function normalizeAnimSpec(spec: AnimSpec): AnimSpec & { type: AnimType } {
  switch (spec.type) {
    case 'slideUp': return { ...spec, type: 'slide', direction: 'up' };
    case 'slideDown': return { ...spec, type: 'slide', direction: 'down' };
    case 'slideLeft': return { ...spec, type: 'slide', direction: 'left' };
    case 'slideRight': return { ...spec, type: 'slide', direction: 'right' };
    case 'wipeUp': return { ...spec, type: 'wipe', direction: 'up' };
    case 'flipX': return { ...spec, type: 'flip', direction: 'up' };
    case 'flipY': return { ...spec, type: 'flip', direction: 'left' };
    default: return spec as AnimSpec & { type: AnimType };
  }
}

// Default direction when the spec has none (slide/rise/wipe enter from
// below, flip around the X axis - the PowerPoint defaults).
export function defaultDirection(type: AnimType): AnimDirection {
  return type === 'flip' ? 'up' : 'up';
}

const easeCache = new Map<string, (n: number) => number>();
function easeFn(name: string): (n: number) => number {
  let fn = easeCache.get(name);
  if (!fn) {
    fn = gsap.parseEase(name || 'power2.out') ?? ((n: number) => n);
    easeCache.set(name, fn);
  }
  return fn;
}

const DIR_VEC: Record<AnimDirection, [number, number]> = {
  up: [0, 1],    // enters moving up = offset starts below
  down: [0, -1],
  left: [1, 0],  // enters moving left = offset starts to the right
  right: [-1, 0]
};

function animOffsets(rawSpec: AnimSpec, p: number, entering: boolean): Partial<BlockVisualState> {
  // p is eased progress 0..1 of the animation. Entering animations run
  // from offset -> rest; exit animations run rest -> offset.
  const spec = normalizeAnimSpec(rawSpec);
  const k = entering ? 1 - p : p;
  const dir = spec.direction ?? defaultDirection(spec.type);
  const [vx, vy] = DIR_VEC[dir];
  switch (spec.type) {
    case 'fade': return { opacity: 1 - k };
    case 'slide': {
      const d = spec.distance ?? SLIDE_DISTANCE;
      return { opacity: 1 - k, translateX: vx * d * k, translateY: vy * d * k };
    }
    case 'rise': {
      // PowerPoint's Rise Up: a long decelerating travel with the fade
      // finishing early, so the move reads clearly.
      const d = spec.distance ?? RISE_DISTANCE;
      return { opacity: 1 - Math.min(1, k * 1.6), translateX: vx * d * k, translateY: vy * d * k };
    }
    case 'zoom': return { opacity: 1 - k, scale: 1 - 0.35 * k };
    case 'zoomOut': return { opacity: 1 - k, scale: 1 + 0.4 * k };
    case 'spin': return { opacity: 1 - k, rotate: -180 * k, scale: 1 - 0.3 * k };
    case 'flip':
      return dir === 'left' || dir === 'right'
        ? { opacity: 1 - k, rotateY: (dir === 'left' ? 90 : -90) * k }
        : { opacity: 1 - k, rotateX: (dir === 'up' ? 90 : -90) * k };
    case 'bounceIn': return { opacity: 1 - Math.min(1, k * 2), scale: 1 - 0.6 * k, translateY: -30 * k };
    case 'grow': return { opacity: 1 - k, scale: 1 - k };            // from nothing
    case 'stretch': return { opacity: 1 - Math.min(1, k * 1.4), scaleX: 1 - k }; // unfolds horizontally
    case 'collapse': return { opacity: 1 - Math.min(1, k * 1.4), scaleY: 1 - k }; // unfolds vertically
    case 'drop': return { opacity: 1 - Math.min(1, k * 2), translateY: -(spec.distance ?? 200) * k }; // falls in (pair with bounce ease)
    case 'swivel': return { opacity: 1 - k, rotateY: 360 * k, scale: 1 - 0.2 * k };
    case 'whipIn': return { opacity: 1 - k, translateX: (spec.distance ?? 240) * k * (dir === 'right' ? -1 : 1), rotate: -14 * k, scale: 1 - 0.15 * k };
    case 'wipe': {
      const clip = { top: 0, right: 0, bottom: 0, left: 0 };
      if (dir === 'up') clip.top = k;          // reveals upward from the bottom
      else if (dir === 'down') clip.bottom = k;
      else if (dir === 'left') clip.left = k;  // reveals leftward from the right
      else clip.right = k;
      return { clip: k > 0 ? clip : null };
    }
    case 'popRotate': return { opacity: 1 - k, scale: 1 - 0.5 * k, rotate: 12 * k };
    default: return {};
  }
}

const REST: BlockVisualState = { present: true, opacity: 1, translateX: 0, translateY: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, rotateX: 0, rotateY: 0, clip: null };

// Fold one animation's contribution INTO the running state so several effects
// stack: opacity/scale multiply, translate/rotate add, clip takes the largest
// hidden fraction per side. (A single effect composed from REST is identical
// to overwriting, so this is a safe generalization of the old behavior.)
function composeInto(state: BlockVisualState, o: Partial<BlockVisualState>): void {
  if (o.opacity !== undefined) state.opacity *= o.opacity;
  if (o.translateX !== undefined) state.translateX += o.translateX;
  if (o.translateY !== undefined) state.translateY += o.translateY;
  if (o.scale !== undefined) state.scale *= o.scale;
  if (o.scaleX !== undefined) state.scaleX *= o.scaleX;
  if (o.scaleY !== undefined) state.scaleY *= o.scaleY;
  if (o.rotate !== undefined) state.rotate += o.rotate;
  if (o.rotateX !== undefined) state.rotateX += o.rotateX;
  if (o.rotateY !== undefined) state.rotateY += o.rotateY;
  if (o.clip) {
    state.clip = state.clip
      ? { top: Math.max(state.clip.top, o.clip.top), right: Math.max(state.clip.right, o.clip.right), bottom: Math.max(state.clip.bottom, o.clip.bottom), left: Math.max(state.clip.left, o.clip.left) }
      : o.clip;
  }
}

export function blockStateAt(t: number, timing: BlockTiming | undefined, timelineEnd: number, motion?: MotionPath): BlockVisualState {
  if (!timing) {
    // No entrance/exit, but a motion path still drives position on the clock.
    if (motion) {
      const off = motionOffsetAt(motion, t, easeFn(motion.ease));
      return { ...REST, translateX: off.x, translateY: off.y };
    }
    return REST;
  }
  const start = timing.start ?? 0;
  const end = timing.end ?? timelineEnd;

  if (t < start || t > end) {
    return { ...REST, present: false, opacity: 0 };
  }

  let state = { ...REST };

  // Entrances (animIn + any stacked entrances) all anchor to `start` and
  // compose together.
  const entrances = [timing.animIn, ...(timing.animInStack ?? [])];
  for (const aIn of entrances) {
    if (aIn && aIn.type !== 'none' && aIn.duration > 0) {
      const p = Math.min(1, (t - start) / aIn.duration);
      composeInto(state, animOffsets(aIn, easeFn(aIn.ease)(p), true));
    }
  }

  // Exits (animOut + any stacked exits) all end at `end`; each has its own
  // lead-in length.
  if (timing.end !== undefined) {
    const exits = [timing.animOut, ...(timing.animOutStack ?? [])];
    for (const aOut of exits) {
      if (aOut && aOut.type !== 'none' && aOut.duration > 0) {
        const outStart = end - aOut.duration;
        if (t >= outStart) {
          const p = Math.min(1, (t - outStart) / aOut.duration);
          composeInto(state, animOffsets(aOut, easeFn(aOut.ease)(p), false));
        }
      }
    }
  }

  // Motion path adds to whatever the entrance/exit produced, so a block can
  // slide in AND then travel along a path.
  if (motion) {
    const off = motionOffsetAt(motion, t, easeFn(motion.ease));
    state.translateX += off.x;
    state.translateY += off.y;
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
  const c = state.clip;
  return {
    opacity: state.opacity,
    transform:
      `translate(${state.translateX}px, ${state.translateY}px)` +
      ` scale(${state.scale})` +
      (state.scaleX !== 1 ? ` scaleX(${state.scaleX})` : '') +
      (state.scaleY !== 1 ? ` scaleY(${state.scaleY})` : '') +
      (state.rotate ? ` rotate(${state.rotate}deg)` : '') +
      (state.rotateX ? ` rotateX(${state.rotateX}deg)` : '') +
      (state.rotateY ? ` rotateY(${state.rotateY}deg)` : ''),
    perspective: 600,
    // Non-wiped sides inset by -100% so geometry that legitimately overflows
    // the block (callout tails, arrowheads) stays visible during the wipe.
    clipPath: c
      ? `inset(${side(c.top)} ${side(c.right)} ${side(c.bottom)} ${side(c.left)})`
      : undefined,
    pointerEvents: state.present ? undefined : 'none',
    visibility: state.present ? undefined : 'hidden'
  };
}

// The wiped side sweeps -25% -> 125%: a margin on both ends so geometry
// hanging slightly outside the block wipes with it instead of popping,
// while the visible crossing still spans essentially the whole duration.
const side = (k: number) => (k > 0 ? `${(k * 150 - 25).toFixed(2)}%` : '-100%');
