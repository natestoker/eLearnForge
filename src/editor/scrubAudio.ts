import type { Slide } from '../schema/types';
import { walkBlocks } from '../state/projectStore';

// Audio scrubbing for the editor timeline: while the playhead drags, every
// audio source scheduled at that moment (slide narration, audio blocks,
// block-attached audio) seeks there and plays a short snippet - the
// Premiere/After Effects behavior that lets you sync animation to speech
// by ear instead of replaying from the top.
export class ScrubAudio {
  private els: { el: HTMLAudioElement; start: number; end: number }[] = [];
  private stopTimer: number | null = null;

  load(slide: Slide, duration: number): void {
    this.dispose();
    const add = (src: string, start: number, end: number) => {
      const el = new Audio(src);
      el.preload = 'auto';
      this.els.push({ el, start, end });
    };
    if (slide.timeline?.narrationSrc) add(slide.timeline.narrationSrc, 0, duration);
    for (const b of walkBlocks(slide.layers.flatMap((l) => l.blocks))) {
      const src = b.type === 'audio'
        ? (b.props as { src?: string }).src
        : b.audio?.src;
      if (!src) continue;
      add(src, b.timing?.start ?? 0, b.timing?.end ?? duration);
    }
  }

  // Seek every in-window source to the playhead and play ~140ms. Repeated
  // calls while dragging keep pushing the stop out, so a continuous drag
  // sounds continuous.
  scrub(t: number): void {
    for (const { el, start, end } of this.els) {
      if (t < start || t > end) {
        if (!el.paused) el.pause();
        continue;
      }
      const local = t - start;
      if (Number.isFinite(el.duration) && local > el.duration) {
        if (!el.paused) el.pause();
        continue;
      }
      try { el.currentTime = local; } catch { /* metadata not ready yet */ }
      el.play().catch(() => { /* autoplay policy: needs the user gesture, which a drag is */ });
    }
    if (this.stopTimer) window.clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => this.pauseAll(), 140);
  }

  // Continuous playback for the timeline Play button: seek everything to t
  // once, then keep sources starting/stopping as their windows open/close.
  // Unlike scrub(), nothing auto-pauses - the caller owns the clock.
  playFrom(t: number): void {
    if (this.stopTimer) window.clearTimeout(this.stopTimer);
    this.stopTimer = null;
    this.syncPlaying(t, true);
  }

  syncPlaying(t: number, seek = false): void {
    for (const { el, start, end } of this.els) {
      const past = Number.isFinite(el.duration) && t - start > el.duration;
      const inWindow = t >= start && t <= end && !past;
      if (inWindow) {
        if (el.paused) {
          try { el.currentTime = Math.max(0, t - start); } catch { /* not ready */ }
          el.play().catch(() => { /* needs gesture; Play click is one */ });
        } else if (seek) {
          try { el.currentTime = Math.max(0, t - start); } catch { /* not ready */ }
        }
      } else if (!el.paused) {
        el.pause();
      }
    }
  }

  pauseAll(): void {
    this.els.forEach(({ el }) => el.pause());
  }

  dispose(): void {
    if (this.stopTimer) window.clearTimeout(this.stopTimer);
    this.stopTimer = null;
    this.pauseAll();
    this.els = [];
  }
}
