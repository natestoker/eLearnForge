import { useEffect, useState } from 'react';

// Turn raw WebVTT text into an object URL usable as a <track src>. Browsers
// refuse to load <track> from a data: URL (treated as cross-origin), so we
// mint a Blob URL and revoke it when the text changes or the block unmounts.
export function useVttUrl(vtt: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!vtt || !vtt.trim()) { setUrl(undefined); return; }
    // A valid file must start with the WEBVTT signature; add it if the author
    // pasted only cues.
    const body = vtt.trim().startsWith('WEBVTT') ? vtt : `WEBVTT\n\n${vtt}`;
    const u = URL.createObjectURL(new Blob([body], { type: 'text/vtt' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [vtt]);
  return url;
}
