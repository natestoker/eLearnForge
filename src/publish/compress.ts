import { encodeMp3 } from '../editor/audioBake';

// In-browser media compression for the Publish checks. Everything stays on the
// learner-author's machine; nothing is uploaded.
//  - Images: scaled to at most 1920px on the long side and re-encoded as WebP.
//  - Audio: decoded, mixed to mono and re-encoded as 96 kbps MP3.
//  - Video: re-encoded with MediaRecorder at about 1.5 Mbps. This runs in real
//    time (a 3-minute video takes about 3 minutes) because the browser can only
//    record a video as it plays. It can be cancelled.
// A result is only used when it is actually smaller than the original.

export interface CompressResult {
  dataUrl: string;
  before: number;
  after: number;
  kind: 'image' | 'audio' | 'video';
  note?: string;
}

export type ProgressFn = (fraction: number) => void;

export const mimeOf = (dataUrl: string): string => {
  const end = dataUrl.indexOf(';') > 0 ? dataUrl.indexOf(';') : dataUrl.indexOf(',');
  return dataUrl.slice(5, end);
};

export function isCompressible(mime: string): boolean {
  return (mime.startsWith('image/') && mime !== 'image/gif' && mime !== 'image/svg+xml')
    || mime.startsWith('audio/') || mime.startsWith('video/');
}

const abortError = () => new DOMException('Cancelled', 'AbortError');

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function compressMedia(dataUrl: string, onProgress?: ProgressFn, signal?: AbortSignal): Promise<CompressResult> {
  const mime = mimeOf(dataUrl);
  if (mime.startsWith('image/')) return compressImage(dataUrl, mime, onProgress);
  if (mime.startsWith('audio/')) return compressAudio(dataUrl, onProgress);
  if (mime.startsWith('video/')) return compressVideo(dataUrl, onProgress, signal);
  throw new Error(`This kind of file (${mime}) can't be compressed here.`);
}

const keepSmaller = (original: string, next: string, kind: CompressResult['kind'], note?: string): CompressResult =>
  next.length < original.length
    ? { dataUrl: next, before: original.length, after: next.length, kind, note }
    : { dataUrl: original, before: original.length, after: original.length, kind, note: 'Already compact; kept as it was.' };

async function compressImage(dataUrl: string, mime: string, onProgress?: ProgressFn): Promise<CompressResult> {
  if (mime === 'image/gif' || mime === 'image/svg+xml') {
    return { dataUrl, before: dataUrl.length, after: dataUrl.length, kind: 'image', note: 'Animated GIFs and SVGs are left as they are.' };
  }
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const MAX = 1920;
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  onProgress?.(0.8);
  const out = canvas.toDataURL('image/webp', 0.82);
  onProgress?.(1);
  return keepSmaller(dataUrl, out, 'image');
}

async function compressAudio(dataUrl: string, onProgress?: ProgressFn): Promise<CompressResult> {
  const bytes = await (await fetch(dataUrl)).arrayBuffer();
  const AC: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  let decoded: AudioBuffer;
  try { decoded = await ctx.decodeAudioData(bytes); } finally { void ctx.close(); }
  onProgress?.(0.4);
  // Mix to mono at a sample rate the MP3 encoder supports.
  const SUPPORTED = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];
  let rate = decoded.sampleRate;
  let mono: Float32Array;
  if (SUPPORTED.includes(rate)) {
    mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const ch = decoded.getChannelData(c);
      for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / decoded.numberOfChannels;
    }
  } else {
    rate = 44100;
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    mono = (await off.startRendering()).getChannelData(0);
  }
  onProgress?.(0.7);
  const mp3 = encodeMp3(mono, rate, 96);
  onProgress?.(0.95);
  const out = await blobToDataUrl(mp3);
  onProgress?.(1);
  return keepSmaller(dataUrl, out, 'audio', 'Converted to 96 kbps mono MP3.');
}

async function compressVideo(dataUrl: string, onProgress?: ProgressFn, signal?: AbortSignal): Promise<CompressResult> {
  if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot re-encode video.');
  const video = document.createElement('video');
  video.src = dataUrl;
  video.playsInline = true;
  video.preload = 'auto';
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('The video could not be read.'));
  });
  // WebM files written by MediaRecorder carry no duration (Infinity). Seeking
  // far past the end makes the browser work it out, so progress can be shown.
  if (!Number.isFinite(video.duration)) {
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = 1e9;
      window.setTimeout(resolve, 3000);
    });
    video.onseeked = null;
    video.currentTime = 0;
    await new Promise<void>((resolve) => { video.onseeked = () => resolve(); window.setTimeout(resolve, 1000); });
    video.onseeked = null;
  }
  const stream: MediaStream = (video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
  const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error('This browser cannot record WebM video.');
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 96_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  const duration = video.duration;
  const tick = window.setInterval(() => {
    if (Number.isFinite(duration) && duration > 0) onProgress?.(Math.min(0.99, video.currentTime / duration));
  }, 250);
  const cleanup = () => { window.clearInterval(tick); video.pause(); stream.getTracks().forEach((t) => t.stop()); video.removeAttribute('src'); video.load(); };
  const onAbort = () => { if (recorder.state !== 'inactive') recorder.stop(); };
  signal?.addEventListener('abort', onAbort);
  try {
    recorder.start(1000);
    await video.play();
    await new Promise<void>((resolve) => { video.onended = () => resolve(); signal?.addEventListener('abort', () => resolve()); });
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    cleanup();
  }
  if (signal?.aborted) throw abortError();
  const out = await blobToDataUrl(new Blob(chunks, { type: 'video/webm' }));
  onProgress?.(1);
  return keepSmaller(dataUrl, out, 'video', 'Re-encoded as WebM at about 1.5 Mbps.');
}

// Path helpers: media lives at arbitrary depths of the project, so a found
// file is addressed by its path of keys and indexes.
export function getAtPath(root: unknown, path: (string | number)[]): unknown {
  return path.reduce<unknown>((o, k) => (o == null ? o : (o as Record<string | number, unknown>)[k]), root);
}

export function setAtPath(root: unknown, path: (string | number)[], value: unknown): void {
  const parent = getAtPath(root, path.slice(0, -1)) as Record<string | number, unknown> | undefined;
  if (parent) parent[path[path.length - 1]] = value;
}
