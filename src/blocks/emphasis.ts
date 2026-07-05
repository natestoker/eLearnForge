import { gsap } from 'gsap';

// Looping "attention" animations (GSAP), independent of the timeline. They
// run continuously in the player to draw the eye - a hint that bobs, a
// button that pulses. Returns a cleanup that kills the tween.

export type Emphasis = 'none' | 'pulse' | 'bounce' | 'shake' | 'float' | 'wobble' | 'tada' | 'heartbeat' | 'glow';

export function runEmphasis(el: HTMLElement, kind: Emphasis): () => void {
  let tween: gsap.core.Tween | gsap.core.Timeline | null = null;
  if (kind === 'pulse') {
    tween = gsap.to(el, { scale: 1.06, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: 'center' });
  } else if (kind === 'bounce') {
    tween = gsap.to(el, { y: -10, duration: 0.5, repeat: -1, yoyo: true, ease: 'power1.inOut' });
  } else if (kind === 'shake') {
    tween = gsap.to(el, { x: '+=6', duration: 0.08, repeat: -1, yoyo: true, ease: 'none' });
  } else if (kind === 'float') {
    tween = gsap.to(el, { y: -8, duration: 2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  } else if (kind === 'wobble') {
    tween = gsap.to(el, { rotation: 3, duration: 0.5, repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: 'center' });
  } else if (kind === 'tada') {
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });
    tl.to(el, { scale: 0.92, rotation: -3, duration: 0.15, transformOrigin: 'center' })
      .to(el, { scale: 1.1, rotation: 3, duration: 0.15 })
      .to(el, { rotation: -3, duration: 0.1 })
      .to(el, { rotation: 3, duration: 0.1 })
      .to(el, { scale: 1, rotation: 0, duration: 0.15 });
    tween = tl;
  } else if (kind === 'heartbeat') {
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
    tl.to(el, { scale: 1.15, duration: 0.14, transformOrigin: 'center', ease: 'power2.out' })
      .to(el, { scale: 1, duration: 0.14, ease: 'power2.in' })
      .to(el, { scale: 1.12, duration: 0.14, ease: 'power2.out' })
      .to(el, { scale: 1, duration: 0.2, ease: 'power2.in' });
    tween = tl;
  } else if (kind === 'glow') {
    tween = gsap.to(el, { filter: 'drop-shadow(0 0 10px rgba(61,220,151,0.9))', duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }
  return () => { tween?.kill(); gsap.set(el, { clearProps: 'transform,filter' }); };
}
