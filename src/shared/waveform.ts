// Decode an audio source into a small array of amplitude peaks for drawing a
// waveform. Decoding is async and cached by source string so the same clip
// is only decoded once, even across the canvas chip and the timeline bar.

const cache = new Map<string, number[]>();
const pending = new Map<string, Promise<number[]>>();

let ctx: AudioContext | null = null;
function audioCtx(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

// Reduce a channel to `buckets` peak values in 0..1.
function peaks(data: Float32Array, buckets: number): number[] {
  const size = Math.floor(data.length / buckets) || 1;
  const out: number[] = [];
  let max = 0.0001;
  for (let i = 0; i < buckets; i++) {
    let peak = 0;
    const start = i * size;
    for (let j = 0; j < size && start + j < data.length; j++) {
      const v = Math.abs(data[start + j]);
      if (v > peak) peak = v;
    }
    out.push(peak);
    if (peak > max) max = peak;
  }
  // Normalize so the loudest peak fills the height.
  return out.map((p) => p / max);
}

async function decode(src: string, buckets: number): Promise<number[]> {
  const resp = await fetch(src);
  const buf = await resp.arrayBuffer();
  const audio = await audioCtx().decodeAudioData(buf);
  const chan = audio.getChannelData(0);
  return peaks(chan, buckets);
}

export function getWaveform(src: string, buckets = 40): number[] | null {
  const key = `${buckets}:${src.slice(0, 64)}:${src.length}`;
  return cache.get(key) ?? null;
}

// Kick off decoding; resolves with peaks and populates the cache. Safe to
// call repeatedly - concurrent calls share one decode.
export function loadWaveform(src: string, buckets = 40): Promise<number[]> {
  const key = `${buckets}:${src.slice(0, 64)}:${src.length}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const job = decode(src, buckets)
    .then((p) => { cache.set(key, p); pending.delete(key); return p; })
    .catch(() => { pending.delete(key); return []; });
  pending.set(key, job);
  return job;
}
