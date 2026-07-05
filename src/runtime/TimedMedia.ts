// Reconciles timed <audio>/<video> elements against the slide clock so an
// audio block on the timeline behaves like a voice-over track: it starts
// at its bar's start, follows seeks, pauses with the clock, and stays
// sample-accurate within a drift tolerance instead of fighting the clock
// every frame.

interface Entry {
  el: HTMLMediaElement;
  start: number;
}

const DRIFT = 0.3; // seconds of tolerated divergence before a hard resync

export class TimedMedia {
  private entries = new Map<string, Entry>();

  register(blockId: string, el: HTMLMediaElement | null, start: number): void {
    if (!el) {
      this.entries.delete(blockId);
      return;
    }
    this.entries.set(blockId, { el, start });
  }

  sync(t: number, playing: boolean): void {
    for (const { el, start } of this.entries.values()) {
      const local = t - start;
      const dur = isFinite(el.duration) ? el.duration : Infinity;
      const inWindow = local >= 0 && local < dur;
      if (playing && inWindow) {
        if (Math.abs(el.currentTime - local) > DRIFT) el.currentTime = Math.max(0, local);
        if (el.paused) el.play().catch(() => { /* gesture policy; controls remain */ });
      } else if (!el.paused) {
        el.pause();
        if (!inWindow && local < 0) el.currentTime = 0;
      }
    }
  }

  reset(): void {
    for (const { el } of this.entries.values()) {
      try { el.pause(); el.currentTime = 0; } catch { /* detached */ }
    }
    this.entries.clear();
  }
}
