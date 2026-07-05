// Speaker-notes narration via the Web Speech API, hardened with the
// patterns proven in the PPTX Narrator work:
// - epoch guard: every async callback checks its epoch so a stale
//   utterance can never act after a seek/slide change
// - Chrome drops speak() right after cancel(): defer by 50ms
// - duration is an estimate (14.5 chars/sec at rate 1), corrected by
//   nothing here - the timeline clock stays authoritative and the
//   utterance's end snaps the clock to the end
// - seeking restarts speech from a character offset proportional to t
//   (Web Speech cannot seek within an utterance)

export const CHARS_PER_SEC = 14.5;

export function ttsEstimate(text: string, rate: number): number {
  return Math.max(0.5, text.length / (CHARS_PER_SEC * Math.max(0.25, rate)));
}

export interface TtsOptions {
  voiceName?: string;
  rate: number;
  onEnd: () => void;
}

export class TtsEngine {
  private epoch = 0;
  private text: string;
  private opts: TtsOptions;

  constructor(text: string, opts: TtsOptions) {
    this.text = text;
    this.opts = opts;
  }

  get duration(): number {
    return ttsEstimate(this.text, this.opts.rate);
  }

  setPrefs(voiceName: string | undefined, rate: number): void {
    this.opts.voiceName = voiceName;
    this.opts.rate = Math.min(2, Math.max(0.25, rate));
  }

  private offsetForTime(t: number): number {
    const chars = Math.floor(t * CHARS_PER_SEC * this.opts.rate);
    let i = Math.min(chars, this.text.length);
    // Snap back to a word start so speech never begins mid-word.
    while (i > 0 && !/\s/.test(this.text[i - 1])) i--;
    return i;
  }

  playFrom(t: number): void {
    this.stop();
    const myEpoch = this.epoch;
    const offset = this.offsetForTime(t);
    const remainder = this.text.slice(offset);
    if (!remainder.trim()) return;
    // Deferred: Chrome silently drops speak() issued right after cancel().
    window.setTimeout(() => {
      if (myEpoch !== this.epoch) return;
      const utter = new SpeechSynthesisUtterance(remainder);
      utter.rate = this.opts.rate;
      if (this.opts.voiceName) {
        const v = window.speechSynthesis.getVoices().find((vc) => vc.name === this.opts.voiceName);
        if (v) utter.voice = v;
      }
      utter.onend = () => {
        if (myEpoch !== this.epoch) return;
        this.opts.onEnd();
      };
      window.speechSynthesis.speak(utter);
    }, 50);
  }

  stop(): void {
    this.epoch++;
    try { window.speechSynthesis.cancel(); } catch { /* no speech support */ }
  }
}

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
