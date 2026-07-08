// Minimal WebVTT parser: enough to drive an in-stage caption overlay synced
// to the slide clock. Handles the WEBVTT header, optional cue ids, and
// `HH:MM:SS.mmm` / `MM:SS.mmm` timestamps. Styling tags are stripped.

export interface Cue { start: number; end: number; text: string; }

function parseTime(s: string): number {
  const parts = s.trim().split(':');
  let sec = 0;
  for (const p of parts) sec = sec * 60 + parseFloat(p);
  return sec;
}

export function parseVtt(vtt: string | undefined): Cue[] {
  if (!vtt) return [];
  const cues: Cue[] = [];
  const blocks = vtt.replace(/\r/g, '').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) continue;
    // Find the timing line (contains "-->"); text follows it.
    const idx = lines.findIndex((l) => l.includes('-->'));
    if (idx < 0) continue;
    const m = lines[idx].match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
    if (!m) continue;
    const text = lines.slice(idx + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    cues.push({ start: parseTime(m[1]), end: parseTime(m[2]), text });
  }
  return cues;
}

// The cue active at time t (seconds), or null. Linear scan is fine for the
// handful of cues a slide carries.
export function cueAt(cues: Cue[], t: number): Cue | null {
  for (const c of cues) if (t >= c.start && t < c.end) return c;
  return null;
}
