// Turns one accent color into the set of CSS variables the editor and player
// chrome use, and keeps it readable: the color is nudged lighter until it
// reaches 4.5:1 against the dark panel surface (it is used as text and as
// fills), and the text that sits on top of it is picked for contrast too.

export const DEFAULT_ACCENT = '#3ddc97';
const SURFACE = '#171b18'; // editor panel background

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const mix = (c: [number, number, number], to: [number, number, number], t: number): [number, number, number] =>
  [c[0] + (to[0] - c[0]) * t, c[1] + (to[1] - c[1]) * t, c[2] + (to[2] - c[2]) * t];

export interface AccentVars {
  '--accent': string;
  '--accent-bright': string;
  '--accent-dim': string;
  '--accent-ink': string;
  '--accent-rgb': string;
  '--c-accent-text': string;
}

export function deriveAccent(hex: string | undefined, surface: string = SURFACE): AccentVars {
  const base = parseHex(hex ?? '') ?? parseHex(DEFAULT_ACCENT)!;
  const bg = parseHex(surface)!;
  // Lighten toward white until it reads on the dark surface.
  let c = base;
  for (let i = 0; i < 20 && contrast(c, bg) < 4.5; i++) c = mix(c, [255, 255, 255], 0.08);
  const bright = mix(c, [255, 255, 255], 0.22);
  const dark: [number, number, number] = [5, 16, 11];
  const ink = contrast(c, dark) >= contrast(c, [255, 255, 255]) ? dark : ([255, 255, 255] as [number, number, number]);
  // Inside slides the accent is text on light surfaces: darken the author's
  // color until it clears 4.5:1 on white.
  let onLight = base;
  for (let i = 0; i < 30 && contrast(onLight, [255, 255, 255]) < 4.5; i++) onLight = mix(onLight, [0, 0, 0], 0.08);
  const rgb = c.map((v) => Math.round(v)).join(', ');
  return {
    '--accent': toHex(...c),
    '--accent-bright': toHex(...bright),
    '--accent-dim': `rgba(${rgb}, 0.14)`,
    '--accent-ink': toHex(...ink),
    '--accent-rgb': rgb,
    '--c-accent-text': toHex(...onLight)
  };
}
