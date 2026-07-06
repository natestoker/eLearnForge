// A curated set of Google Fonts. Loading is on demand: when a family is
// first used, a <link> is injected. The list is deliberately short and
// covers display, serif, sans, and mono needs for course design.

export const SYSTEM_FONTS: { family: string; category: string }[] = [
  { family: 'Arial', category: 'system sans' },
  { family: 'Helvetica', category: 'system sans' },
  { family: 'Verdana', category: 'system sans' },
  { family: 'Trebuchet MS', category: 'system sans' },
  { family: 'Times New Roman', category: 'system serif' },
  { family: 'Georgia', category: 'system serif' },
  { family: 'Garamond', category: 'system serif' },
  { family: 'Courier New', category: 'system mono' },
  { family: 'Impact', category: 'system display' },
  { family: 'Arial Black', category: 'system display' }
];

export const GOOGLE_FONTS: { family: string; category: string }[] = [
  { family: 'Inter', category: 'sans' },
  { family: 'Roboto', category: 'sans' },
  { family: 'Open Sans', category: 'sans' },
  { family: 'Montserrat', category: 'sans' },
  { family: 'Poppins', category: 'sans' },
  { family: 'Nunito', category: 'sans' },
  { family: 'Work Sans', category: 'sans' },
  { family: 'Lato', category: 'sans' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Bitter', category: 'serif' },
  { family: 'Oswald', category: 'display' },
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Archivo Black', category: 'display' },
  { family: 'JetBrains Mono', category: 'mono' },
  { family: 'Fira Code', category: 'mono' },
  { family: 'Space Mono', category: 'mono' }
];

const loaded = new Set<string>();

// The <link> href for a set of families (weights 400 and 700).
export function googleFontsHref(families: string[]): string {
  const fams = families
    .filter((f) => GOOGLE_FONTS.some((g) => g.family === f))
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${fams}&display=swap`;
}

// Inject (once) a stylesheet link for a family into the given document,
// so both the editor and an exported course can call it.
export function ensureFont(family: string, doc: Document = document): void {
  if (!family || loaded.has(family) || !GOOGLE_FONTS.some((g) => g.family === family)) return;
  loaded.add(family);
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = googleFontsHref([family]);
  doc.head.appendChild(link);
}

// Inject @font-face rules for fonts embedded from an imported PowerPoint, so
// the deck's own typefaces render even when they aren't Google fonts.
const embeddedInjected = new Set<string>();
export function ensureEmbeddedFonts(
  fonts: { family: string; dataUrl: string; weight?: number; italic?: boolean }[] | undefined,
  doc: Document = document
): void {
  if (!fonts) return;
  for (const f of fonts) {
    const key = `${f.family}:${f.weight ?? 400}:${f.italic ? 'i' : 'n'}`;
    if (embeddedInjected.has(key)) continue;
    embeddedInjected.add(key);
    const style = doc.createElement('style');
    style.textContent =
      `@font-face{font-family:'${f.family}';src:url(${f.dataUrl});` +
      `font-weight:${f.weight ?? 400};font-style:${f.italic ? 'italic' : 'normal'};font-display:swap;}`;
    doc.head.appendChild(style);
  }
}
