import { useEffect, useState } from 'react';
import { getWaveform, loadWaveform } from './waveform';

// Returns amplitude peaks for an audio src, decoding lazily. Null until ready.
export function useWaveform(src: string | undefined, buckets = 40): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(() => (src ? getWaveform(src, buckets) : null));
  useEffect(() => {
    let alive = true;
    if (!src) { setPeaks(null); return; }
    const cached = getWaveform(src, buckets);
    if (cached) { setPeaks(cached); return; }
    loadWaveform(src, buckets).then((p) => { if (alive) setPeaks(p.length ? p : null); });
    return () => { alive = false; };
  }, [src, buckets]);
  return peaks;
}
