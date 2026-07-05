// The slide clock. When narration audio exists it IS the clock - t reads
// audio.currentTime, so audio and visuals can never drift and seeking the
// bar seeks the audio. Without narration, requestAnimationFrame advances t.
// onEnd fires exactly once per run; seeking backward re-arms it.

import { TtsEngine, ttsAvailable, ttsEstimate } from './tts';

export interface ClockOptions {
  duration: number;
  narrationSrc?: string;
  // Speaker-notes TTS: used only when no narrationSrc is set.
  ttsText?: string;
  ttsVoiceName?: string;
  ttsRate?: number;
  onTick: (t: number) => void;
  onPlayState: (playing: boolean) => void;
  onEnd: () => void;
  // Fired when the real duration becomes known (narration metadata loads).
  onDuration?: (d: number) => void;
}

export class TimelineClock {
  private opts: ClockOptions;
  private audio: HTMLAudioElement | null = null;
  private raf = 0;
  private rafBase = 0;   // t at last play() for the rAF path
  private rafStart = 0;  // performance.now() at last play()
  private t = 0;
  private playing = false;
  private ended = false;
  private disposed = false;

  private tts: TtsEngine | null = null;

  constructor(opts: ClockOptions) {
    this.opts = opts;
    if (!opts.narrationSrc && opts.ttsText && ttsAvailable()) {
      // TTS drives nothing - the rAF clock stays authoritative with an
      // estimated duration; the utterance ending snaps the clock forward.
      this.opts.duration = ttsEstimate(opts.ttsText, opts.ttsRate ?? 1);
      this.opts.onDuration?.(this.opts.duration);
      this.tts = new TtsEngine(opts.ttsText, {
        voiceName: opts.ttsVoiceName,
        rate: opts.ttsRate ?? 1,
        onEnd: () => {
          // Estimate ran long: jump to the end so visuals settle with the voice.
          if (this.playing) {
            this.t = this.opts.duration;
            this.opts.onTick(this.t);
            this.finish();
          }
        }
      });
    }
    if (opts.narrationSrc) {
      this.audio = new Audio(opts.narrationSrc);
      this.audio.preload = 'auto';
      // Narration length wins over the configured duration once known.
      this.audio.addEventListener('loadedmetadata', () => {
        if (this.audio && isFinite(this.audio.duration) && this.audio.duration > 0) {
          this.opts.duration = this.audio.duration;
          this.opts.onDuration?.(this.audio.duration);
        }
      });
      this.audio.addEventListener('ended', () => this.finish());
    }
  }

  get duration(): number {
    return this.opts.duration;
  }

  // Learner-facing voice controls (Narrator model): apply immediately by
  // restarting speech from the current position when playing.
  setTtsPrefs(voiceName: string | undefined, rate: number): void {
    if (!this.tts) return;
    this.tts.setPrefs(voiceName, rate);
    this.opts.duration = this.tts.duration;
    this.opts.onDuration?.(this.opts.duration);
    if (this.playing) {
      this.tts.playFrom(this.t);
      // Re-anchor the rAF clock so estimate changes do not jump t.
      this.rafBase = this.t;
      this.rafStart = performance.now();
    }
  }

  get time(): number {
    return this.t;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  play = (): void => {
    if (this.disposed) return;
    if (this.t >= this.opts.duration) this.seek(0);
    this.playing = true;
    this.ended = false;
    this.opts.onPlayState(true);
    if (this.audio) {
      // Autoplay policies can reject; fall back to the rAF clock so the
      // visuals still run even if sound waits for a user gesture.
      this.audio.play().catch(() => this.startRaf());
      this.startAudioPoll();
    } else {
      this.tts?.playFrom(this.t);
      this.startRaf();
    }
  };

  pause = (): void => {
    this.playing = false;
    this.opts.onPlayState(false);
    this.audio?.pause();
    this.tts?.stop();
    cancelAnimationFrame(this.raf);
  };

  seek = (to: number): void => {
    const clamped = Math.max(0, Math.min(to, this.opts.duration));
    this.t = clamped;
    if (clamped < this.opts.duration) this.ended = false;
    if (this.audio) this.audio.currentTime = clamped;
    // Web Speech cannot seek: restart from the proportional char offset.
    if (this.tts && this.playing) this.tts.playFrom(clamped);
    this.rafBase = clamped;
    this.rafStart = performance.now();
    this.opts.onTick(clamped);
  };

  private startAudioPoll(): void {
    cancelAnimationFrame(this.raf);
    const poll = () => {
      if (this.disposed || !this.playing) return;
      if (this.audio) {
        this.t = this.audio.currentTime;
        this.opts.onTick(this.t);
      }
      this.raf = requestAnimationFrame(poll);
    };
    this.raf = requestAnimationFrame(poll);
  }

  private startRaf(): void {
    cancelAnimationFrame(this.raf);
    this.rafBase = this.t;
    this.rafStart = performance.now();
    const step = (now: number) => {
      if (this.disposed || !this.playing) return;
      this.t = this.rafBase + (now - this.rafStart) / 1000;
      if (this.t >= this.opts.duration) {
        this.t = this.opts.duration;
        this.opts.onTick(this.t);
        this.finish();
        return;
      }
      this.opts.onTick(this.t);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.playing = false;
    this.opts.onPlayState(false);
    this.tts?.stop();
    cancelAnimationFrame(this.raf);
    this.opts.onEnd();
  }

  dispose(): void {
    this.disposed = true;
    this.tts?.stop();
    cancelAnimationFrame(this.raf);
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }
}
