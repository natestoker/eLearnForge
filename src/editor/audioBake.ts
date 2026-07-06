import { Mp3Encoder } from '@breezystack/lamejs';
import type { KokoroTTS as KokoroTTSType } from 'kokoro-js';

// kokoro-js (and its onnxruntime-web WASM) is large, so it is NOT bundled;
// it is dynamically imported from a CDN the first time the author bakes.
// The @vite-ignore keeps the bundler from trying to inline the chunk.
const KOKORO_CDN = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
type KokoroModule = { KokoroTTS: typeof KokoroTTSType };
let kokoroModPromise: Promise<KokoroModule> | null = null;
function loadKokoroModule(): Promise<KokoroModule> {
  if (!kokoroModPromise) {
    kokoroModPromise = import(/* @vite-ignore */ KOKORO_CDN) as Promise<KokoroModule>;
  }
  return kokoroModPromise;
}

// Bake narration to a real audio file by SYNTHESIZING the waveform in the
// browser (Kokoro-82M via ONNX/WASM), not by capturing speechSynthesis.
// This matters: speechSynthesis output cannot be routed into Web Audio and
// system voices bypass tab-audio capture entirely, so the old capture path
// produced silence on many setups (and never worked on Mac). Synthesis is
// deterministic and cross-platform; the model is fetched once (~86MB q8)
// then cached by the browser. The published course still ships the baked
// file and stays fully offline.

export type BakeFormat = 'wav' | 'mp3';

export interface BakeResult {
  blob: Blob;
  dataUrl: string;
  seconds: number;
}

// Kokoro voice ids we surface, with our own labels.
export const BAKE_VOICES: { id: string; label: string }[] = [
  { id: 'af_heart', label: 'Heart (US, female)' },
  { id: 'af_bella', label: 'Bella (US, female)' },
  { id: 'af_nicole', label: 'Nicole (US, female)' },
  { id: 'af_sarah', label: 'Sarah (US, female)' },
  { id: 'am_michael', label: 'Michael (US, male)' },
  { id: 'am_fenrir', label: 'Fenrir (US, male)' },
  { id: 'am_puck', label: 'Puck (US, male)' },
  { id: 'bf_emma', label: 'Emma (UK, female)' },
  { id: 'bm_george', label: 'George (UK, male)' }
];

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let ttsPromise: Promise<KokoroTTSType> | null = null;

// Lazily load the model once per session; the browser caches weights on
// disk (Cache Storage) across sessions.
export function loadTts(onProgress?: (pct: number) => void): Promise<KokoroTTSType> {
  if (!ttsPromise) {
    ttsPromise = loadKokoroModule().then((mod) =>
      mod.KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p: { status: string; progress?: number }) => {
          if (onProgress && typeof p.progress === 'number') onProgress(p.progress);
        }
      } as never)
    );
  }
  return ttsPromise;
}

export function isModelLoaded(): boolean {
  return ttsPromise !== null;
}

function floatToInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// Trim leading/trailing near-silence so the clip starts on the voice.
export function trimSilence(mono: Float32Array, sampleRate: number, threshold = 0.008): { data: Float32Array; seconds: number } {
  const win = Math.max(1, Math.floor(sampleRate * 0.02));
  const loud = (start: number) => {
    let sum = 0;
    for (let i = start; i < start + win && i < mono.length; i++) sum += mono[i] * mono[i];
    return Math.sqrt(sum / win) > threshold;
  };
  let head = 0;
  while (head < mono.length && !loud(head)) head += win;
  let tail = mono.length - win;
  while (tail > head && !loud(tail)) tail -= win;
  const pad = Math.floor(sampleRate * 0.05);
  const from = Math.max(0, head - pad);
  const to = Math.min(mono.length, tail + win + pad);
  const data = mono.subarray(from, to);
  return { data: data.length ? data : mono, seconds: (data.length || mono.length) / sampleRate };
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export function encodeWav(mono: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataSize = mono.length * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < mono.length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

export function encodeMp3(mono: Float32Array, sampleRate: number, kbps = 128): Blob {
  const enc = new Mp3Encoder(1, sampleRate, kbps);
  const int16 = floatToInt16(mono);
  const block = 1152;
  const out: BlobPart[] = [];
  for (let i = 0; i < int16.length; i += block) {
    const chunk = int16.subarray(i, i + block);
    const mp3 = enc.encodeBuffer(chunk);
    if (mp3.length) out.push(new Uint8Array(mp3).slice().buffer);
  }
  const end = enc.flush();
  if (end.length) out.push(new Uint8Array(end).slice().buffer);
  return new Blob(out, { type: 'audio/mpeg' });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('encode failed'));
    r.readAsDataURL(blob);
  });
}

// Synthesize speech to a mono Float32 buffer with Kokoro.
export async function synthesize(text: string, voiceId: string, onProgress?: (pct: number) => void):
  Promise<{ data: Float32Array; sampleRate: number }> {
  const tts = await loadTts(onProgress);
  
  // Split into sentences, keeping punctuation
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) {
    return { data: new Float32Array(0), sampleRate: 24000 };
  }

  const chunks: Float32Array[] = [];
  let sampleRate = 24000;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const out = await tts.generate(s, { voice: voiceId as never });
    if (out.audio) {
      chunks.push(out.audio as Float32Array);
    }
    if (out.sampling_rate) {
      sampleRate = out.sampling_rate as number;
    }
    if (onProgress) {
      onProgress(Math.round(((i + 1) / sentences.length) * 100));
    }
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  return { data: merged, sampleRate };
}

export async function bufferToResultF32(data: Float32Array, sampleRate: number, format: BakeFormat): Promise<BakeResult> {
  const trimmed = trimSilence(data, sampleRate);
  const blob = format === 'mp3' ? encodeMp3(trimmed.data, sampleRate) : encodeWav(trimmed.data, sampleRate);
  const dataUrl = await blobToDataUrl(blob);
  return { blob, dataUrl, seconds: trimmed.seconds };
}

export async function bakeSpeech(opts: {
  text: string;
  voiceId: string;
  format: BakeFormat;
  onProgress?: (pct: number) => void;
}): Promise<BakeResult> {
  const { data, sampleRate } = await synthesize(opts.text, opts.voiceId, opts.onProgress);
  return bufferToResultF32(data, sampleRate, opts.format);
}

export function downloadBake(result: BakeResult, baseName: string, format: BakeFormat): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Synthesize a short sample of a voice and return a playable WAV data URL,
// so the author can hear a voice before baking a whole slide. Uses the same
// cached model as baking.
export async function previewVoice(voiceId: string, onProgress?: (pct: number) => void): Promise<string> {
  const sample = 'This is how the narration will sound in your course.';
  const { data, sampleRate } = await synthesize(sample, voiceId, onProgress);
  const trimmed = trimSilence(data, sampleRate);
  const blob = encodeWav(trimmed.data, sampleRate);
  return blobToDataUrl(blob);
}
