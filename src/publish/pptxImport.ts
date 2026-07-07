import JSZip from 'jszip';
import type { AnimDirection, AnimSpec, Block, Project, ShadowSpec, Slide, Trigger } from '../schema/types';
import { createLayer, uid } from '../schema/factory';
import { PRSTGEOM_TO_KIND } from '../blocks/shape/geometry';

// Reading pace for pre-estimating a slide duration from its speaker notes
// (average narration speed measured in the PPTX Narrator work).
const NARRATION_CHARS_PER_SEC = 14.5;
function narrationEstimate(text: string): number {
  return Math.max(0.5, text.length / NARRATION_CHARS_PER_SEC);
}

// PowerPoint import. A .pptx is a zip of XML: JSZip opens it, DOMParser
// reads it. Hard-won rules honored here (from the PPTX Narrator work):
// - Parse namespace-aware (getElementsByTagNameNS('*', local)) because
//   prefixes are not guaranteed across files.
// - EMU to px is emu / 9525 (96dpi).
// - Slide count = max of presentation.xml sldIds and slideN.xml files,
//   sorted numerically (slide2 before slide10).
// - Notes: join a:t runs per a:p paragraph, drop slide-number fields.
// This is an editable-approximation importer, not a fidelity renderer:
// shapes relying on placeholder/layout inheritance for geometry or sizing
// may land with defaults. That is the known gap; text and pictures with
// local xfrm come through correctly.

const EMU = 9525;
// PowerPoint font sizes are points (sz = hundredths of a point); the stage
// is a 96dpi pixel canvas, so 1pt = 4/3 px. Importing pt as px rendered
// every run ~25% small - the "slide no longer matches the deck" bug.
const PT_TO_PX = 4 / 3;
const runPx = (szHundredths: number) => (szHundredths / 100) * PT_TO_PX;

// Microsoft fonts that aren't embedded and aren't on Google Fonts get a
// METRIC-COMPATIBLE Google substitute (same widths/heights, so line breaks
// and box fits survive). Families the deck embeds keep their real name -
// the embedded @font-face wins.
const FONT_SUBSTITUTES: Record<string, string> = {
  'calibri': 'Carlito',
  'cambria': 'Caladea',
  'arial': 'Arimo',
  'helvetica': 'Arimo',
  'times new roman': 'Tinos',
  'courier new': 'Cousine',
  'georgia': 'Gelasio',
  'verdana': 'Open Sans',
  'tahoma': 'Open Sans',
  'segoe ui': 'Open Sans',
  'century gothic': 'Questrial',
  'garamond': 'EB Garamond',
  'book antiqua': 'PT Serif',
  'palatino linotype': 'PT Serif'
};
// Families the current import found embedded font files for (set once per
// import; the importer is single-flight).
let EMBEDDED_FAMILIES = new Set<string>();
// Every family the import actually emitted (run spans included), so the
// project's Google Fonts <link> covers substitutes like Carlito.
let SEEN_FONTS = new Set<string>();
function mapFont(name: string): string {
  if (EMBEDDED_FAMILIES.has(name.toLowerCase())) return name;
  const mapped = FONT_SUBSTITUTES[name.toLowerCase()] ?? name;
  SEEN_FONTS.add(mapped);
  return mapped;
}

function local(el: Element | Document, name: string): Element[] {
  return Array.from(el.getElementsByTagNameNS('*', name));
}

function parseXml(s: string): Document {
  return new DOMParser().parseFromString(s, 'application/xml');
}

async function fileString(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.files[path] || zip.files[path.replace(/\//g, '\\')];
  return f ? f.async('string') : null;
}

interface Xfrm { x: number; y: number; w: number; h: number }

function readXfrm(sp: Element): Xfrm | null {
  const xfrm = local(sp, 'xfrm')[0];
  if (!xfrm) return null;
  const off = local(xfrm, 'off')[0];
  const ext = local(xfrm, 'ext')[0];
  if (!off || !ext) return null;
  return {
    x: Number(off.getAttribute('x')) / EMU,
    y: Number(off.getAttribute('y')) / EMU,
    w: Number(ext.getAttribute('cx')) / EMU,
    h: Number(ext.getAttribute('cy')) / EMU
  };
}

function parseParagraphHtml(p: Element, theme: ThemeColors, fontScale = 1): string {
  const htmlParts: string[] = [];
  for (const child of Array.from(p.children)) {
    const name = child.localName;
    if (name === 'r' || name === 'fld') {
      const t = local(child, 't')[0]?.textContent ?? '';
      if (!t) continue;
      
      const escapedText = t
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      const rPr = local(child, 'rPr')[0];
      let style = '';
      let isBold: boolean | null = null;
      let isItalic = false;
      let isUnderline = false;
      
      if (rPr) {
        if (rPr.getAttribute('b') === '1') isBold = true;
        else if (rPr.getAttribute('b') === '0') isBold = false;
        
        if (rPr.getAttribute('i') === '1') isItalic = true;
        if (rPr.getAttribute('u') === 'sng') isUnderline = true;
        
        const sf = local(rPr, 'solidFill')[0];
        if (sf) {
          const runColor = resolveColorEl(sf, theme);
          if (runColor) style += `color: ${runColor};`;
        }
        
        const sz = Number(rPr.getAttribute('sz'));
        if (sz) {
          style += `font-size: ${Math.round(runPx(sz) * fontScale)}px;`;
        }

        const latin = local(rPr, 'latin')[0]?.getAttribute('typeface');
        if (latin && !latin.startsWith('+')) {
          style += `font-family: ${mapFont(latin)};`;
        }
      }
      
      if (isBold === false) {
        style += 'font-weight: normal;';
      }
      
      let part = escapedText;
      if (style) part = `<span style="${style}">${part}</span>`;
      if (isBold === true) part = `<strong>${part}</strong>`;
      if (isItalic) part = `<em>${part}</em>`;
      if (isUnderline) part = `<u>${part}</u>`;
      
      htmlParts.push(part);
    } else if (name === 'br') {
      htmlParts.push('<br/>');
    }
  }
  return htmlParts.join('');
}

function parseTextBodyHtml(sp: Element, theme: ThemeColors, layoutSp?: Element): { html: string; fontSize: number | null; bold: boolean; font: string | null; color: string | null; align: string | null; valign: 'top' | 'center' | 'bottom' | null; lineHeight: number | null } {
  const txBody = local(sp, 'txBody')[0];
  const target = txBody ?? sp;
  const paras = local(target, 'p').filter((p) => p.namespaceURI?.includes('drawingml'));
  const htmlParas: string[] = [];

  let size: number | null = null;
  let bold = false;
  let font: string | null = null;
  let color: string | null = null;
  let align: string | null = null;

  // Vertical anchor lives on bodyPr (anchor="ctr"/"b"); decks that center
  // text in its box rely on it, so dropping it broke their alignment.
  let valign: 'top' | 'center' | 'bottom' | null = null;
  const bodyPr = txBody ? local(txBody, 'bodyPr')[0] : null;
  const anchor = bodyPr?.getAttribute('anchor') ?? null;
  if (anchor === 'ctr') valign = 'center';
  else if (anchor === 'b') valign = 'bottom';
  else if (anchor === 't') valign = 'top';

  // Autofit: PowerPoint shrinks text to fit the box and records the factor
  // (normAutofit fontScale, 100000 = 100%). Ignoring it made autofit decks
  // render oversized and clip.
  const fontScaleAttr = bodyPr ? local(bodyPr, 'normAutofit')[0]?.getAttribute('fontScale') : null;
  const fontScale = fontScaleAttr ? Number(fontScaleAttr) / 100000 : 1;

  // Line spacing: a:lnSpc spcPct (100000 = single). PowerPoint's single
  // spacing renders ~1.2, tighter than our 1.35 default.
  let lineHeight: number | null = null;
  const lnPct = local(target, 'lnSpc')[0] ? local(local(target, 'lnSpc')[0], 'spcPct')[0]?.getAttribute('val') : null;
  if (lnPct) lineHeight = Math.round((Number(lnPct) / 100000) * 1.2 * 100) / 100;

  // Scan all defRPr elements under the target (list styles, body defaults) for block-level fallbacks
  for (const defRPr of local(target, 'defRPr')) {
    if (defRPr.getAttribute('b') === '1') bold = true;
    if (!font) {
      const defLatin = local(defRPr, 'latin')[0]?.getAttribute('typeface');
      if (defLatin && !defLatin.startsWith('+')) font = mapFont(defLatin);
    }
    if (!color) {
      const defSf = local(defRPr, 'solidFill')[0];
      if (defSf) color = resolveColorEl(defSf, theme);
    }
    if (!size) {
      const defSz = Number(defRPr.getAttribute('sz'));
      if (defSz) size = runPx(defSz) * fontScale;
    }
  }

  for (const p of paras) {
    const pPr = local(p, 'pPr')[0];
    let pAlign: string | null = null;
    if (pPr) {
      const algn = pPr.getAttribute('algn');
      if (algn === 'ctr') pAlign = 'center';
      else if (algn === 'r') pAlign = 'right';
      else if (algn === 'just' || algn === 'dist') pAlign = 'justify';
      else if (algn === 'l') pAlign = 'left';
    }
    if (pAlign && !align) align = pAlign;

    const pHtml = parseParagraphHtml(p, theme, fontScale);
    if (pHtml) {
      let pStyle = '';
      if (pAlign) pStyle += `text-align: ${pAlign};`;

      const defRPr = pPr ? local(pPr, 'defRPr')[0] : null;
      if (defRPr) {
        if (defRPr.getAttribute('b') === '1') pStyle += `font-weight: bold;`;

        const sz = Number(defRPr.getAttribute('sz'));
        if (sz) pStyle += `font-size: ${Math.round(runPx(sz) * fontScale)}px;`;

        const sf = local(defRPr, 'solidFill')[0];
        if (sf) {
          const pColor = resolveColorEl(sf, theme);
          if (pColor) pStyle += `color: ${pColor};`;
        }

        const latin = local(defRPr, 'latin')[0]?.getAttribute('typeface');
        if (latin && !latin.startsWith('+')) {
          pStyle += `font-family: ${mapFont(latin)};`;
        }
      }
      
      const styleAttr = pStyle ? ` style="${pStyle}"` : '';
      htmlParas.push(`<div${styleAttr}>${pHtml}</div>`);
    } else {
      htmlParas.push('<div><br/></div>');
    }
  }
  
  for (const rPr of local(target, 'rPr')) {
    const sz = Number(rPr.getAttribute('sz'));
    if (sz && !size) size = runPx(sz) * fontScale;
    if (rPr.getAttribute('b') === '1') bold = true;
  }

  if (layoutSp) {
    const l = parseTextBodyHtml(layoutSp, theme);
    if (!size) size = l.fontSize;
    if (!bold) bold = l.bold;
    if (!font) font = l.font;
    if (!color) color = l.color;
    if (!align) align = l.align;
    if (!valign) valign = l.valign;
    if (!lineHeight) lineHeight = l.lineHeight;
  }

  return {
    html: htmlParas.join(''),
    fontSize: size,
    bold,
    font,
    color,
    align,
    valign,
    lineHeight
  };
}

// Placeholder inheritance. Shapes whose geometry lives on the layout
// (titles, bodies) carry only <p:ph type= idx=>; their xfrm must be read
// from the slideLayout's matching placeholder. Master-level inheritance is
// not chased (layout covers the overwhelming majority of real decks).
// PowerPoint colors are usually theme references (<a:schemeClr
// val="accent1"/>), not literal srgbClr - which is why an importer that
// only reads srgbClr paints everything with its own defaults. The scheme
// lives in ppt/theme/theme1.xml; slides map scheme names through the
// master's clrMap (tx1->dk1 etc). lumMod/lumOff tints are approximated in
// linear RGB, which lands within a shade of PowerPoint's HSL math.
type ThemeColors = Map<string, string>;

const CLR_ALIAS: Record<string, string> = { tx1: 'dk1', tx2: 'dk2', bg1: 'lt1', bg2: 'lt2' };

async function readTheme(zip: JSZip): Promise<ThemeColors> {
  const map: ThemeColors = new Map();
  const themePath = Object.keys(zip.files).find((p) => /^ppt\/theme\/theme\d+\.xml$/i.test(p));
  if (!themePath) return map;
  const str = await fileString(zip, themePath);
  if (!str) return map;
  const doc = parseXml(str);
  const scheme = local(doc, 'clrScheme')[0];
  if (!scheme) return map;
  for (const entry of Array.from(scheme.children)) {
    const name = entry.localName; // dk1, lt1, accent1..6, hlink, folHlink
    const srgb = local(entry, 'srgbClr')[0]?.getAttribute('val');
    const sys = local(entry, 'sysClr')[0]?.getAttribute('lastClr');
    const hex = srgb ?? sys;
    if (hex) map.set(name, `#${hex.toLowerCase()}`);
  }
  return map;
}

function applyLum(hex: string, lumModPct: number, lumOffPct: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => {
    let c = v / 255;
    c = c * lumModPct + lumOffPct;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  };
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), bl = ch(n & 255);
  return '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function resolveColorEl(clrParent: Element, theme: ThemeColors): string | null {
  const srgb = local(clrParent, 'srgbClr')[0];
  if (srgb?.getAttribute('val')) {
    return `#${srgb.getAttribute('val')!.toLowerCase()}`;
  }
  const scrgb = local(clrParent, 'scrgbClr')[0];
  if (scrgb) {
    const r = Math.round((Number(scrgb.getAttribute('r')) / 100000) * 255);
    const g = Math.round((Number(scrgb.getAttribute('g')) / 100000) * 255);
    const b = Math.round((Number(scrgb.getAttribute('b')) / 100000) * 255);
    return `#${[r, g, b].map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('')}`;
  }
  const sys = local(clrParent, 'sysClr')[0];
  if (sys?.getAttribute('lastClr')) {
    return `#${sys.getAttribute('lastClr')!.toLowerCase()}`;
  }
  const prst = local(clrParent, 'prstClr')[0];
  if (prst?.getAttribute('val')) {
    const val = prst.getAttribute('val')!.toLowerCase();
    const prstMap: Record<string, string> = {
      black: '#000000', white: '#ffffff', red: '#ff0000', green: '#00ff00', blue: '#0000ff',
      yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', gray: '#808080', lightgray: '#d3d3d3',
      darkgray: '#a9a9a9'
    };
    if (prstMap[val]) return prstMap[val];
  }
  const scheme = local(clrParent, 'schemeClr')[0];
  if (scheme) {
    const raw = scheme.getAttribute('val') ?? '';
    const name = CLR_ALIAS[raw] ?? raw;
    let hex = theme.get(name);
    if (!hex) return null;
    const lumMod = local(scheme, 'lumMod')[0]?.getAttribute('val');
    const lumOff = local(scheme, 'lumOff')[0]?.getAttribute('val');
    if (lumMod || lumOff) {
      hex = applyLum(hex, lumMod ? Number(lumMod) / 100000 : 1, lumOff ? Number(lumOff) / 100000 : 0);
    }
    return hex;
  }
  return null;
}

type PhKey = string;
function phKey(ph: Element): PhKey {
  return `${ph.getAttribute('type') ?? 'body'}|${ph.getAttribute('idx') ?? ''}`;
}

function extractBgFill(bg: Element | undefined, theme: ThemeColors): string | null {
  if (!bg) return null;
  const bgPr = local(bg, 'bgPr')[0];
  if (bgPr) {
    const sf = local(bgPr, 'solidFill')[0];
    if (sf) return resolveColorEl(sf, theme);
    const gf = local(bgPr, 'gradFill')[0];
    if (gf) return resolveColorEl(local(gf, 'gs')[0] || gf, theme);
  }
  const bgRef = local(bg, 'bgRef')[0];
  if (bgRef) return resolveColorEl(bgRef, theme);
  return null;
}

async function readLayout(zip: JSZip, slidePath: string, theme: ThemeColors): Promise<{ spMap: Map<PhKey, Element>; bgFill: string | null }> {
  const spMap = new Map<PhKey, Element>();
  let bgFill: string | null = null;
  const relsPath = slidePath.replace(/slides\/(slide\d+\.xml)$/i, 'slides/_rels/$1.rels');
  const rels = await fileString(zip, relsPath);
  const m = rels?.match(/Target="\.\.\/(slideLayouts\/slideLayout\d+\.xml)"/i);
  if (!m) return { spMap, bgFill };
  const layoutStr = await fileString(zip, `ppt/${m[1]}`);
  if (!layoutStr) return { spMap, bgFill };
  const doc = parseXml(layoutStr);
  for (const sp of local(doc, 'sp')) {
    const ph = local(sp, 'ph')[0];
    if (ph) spMap.set(phKey(ph), sp);
  }
  bgFill = extractBgFill(local(doc, 'bg')[0], theme);
  return { spMap, bgFill };
}

function fillOf(sp: Element, theme: ThemeColors, layoutSp?: Element): { fill: string; border: string; borderWidth: number } {
  const spPr = local(sp, 'spPr')[0];
  let fill: string | null = null;
  let border = 'transparent';
  let borderWidth = 0;
  if (spPr) {
    if (local(spPr, 'noFill').length) fill = 'transparent';
    for (const sf of local(spPr, 'solidFill')) {
      const inLine = sf.parentElement?.localName === 'ln';
      const hex = resolveColorEl(sf, theme);
      if (!hex) continue;
      if (inLine) border = hex;
      else if (fill === null) fill = hex;
    }
    for (const gf of local(spPr, 'gradFill')) {
      const inLine = gf.parentElement?.localName === 'ln';
      const gs = local(gf, 'gs')[0];
      if (gs) {
        const hex = resolveColorEl(gs, theme);
        if (hex) {
          if (inLine) border = hex;
          else if (fill === null) fill = hex;
        }
      }
    }
    const ln = local(spPr, 'ln')[0];
    if (ln) {
      const w = Number(ln.getAttribute('w'));
      if (w) borderWidth = Math.max(1, Math.round(w / EMU));
      if (border === 'transparent' && borderWidth > 0) border = '#1c222b';
      if (local(ln, 'noFill').length) { border = 'transparent'; borderWidth = 0; }
    }
  }
  if (fill === null) {
    const style = local(sp, 'style')[0];
    const fillRef = style ? local(style, 'fillRef')[0] : null;
    if (fillRef) fill = resolveColorEl(fillRef, theme);
    if (border === 'transparent' && style) {
      const lnRef = local(style, 'lnRef')[0];
      const lnc = lnRef ? resolveColorEl(lnRef, theme) : null;
      if (lnc) { border = lnc; if (!borderWidth) borderWidth = 1; }
    }
  }
  if (layoutSp) {
    const lp = fillOf(layoutSp, theme);
    if (fill === null || fill === '#e8f7f0') fill = lp.fill;
    if (border === 'transparent') { border = lp.border; borderWidth = lp.borderWidth; }
  }
  return { fill: fill ?? 'transparent', border, borderWidth };
}

function prstGeomOf(sp: Element): string | null {
  const g = local(sp, 'prstGeom')[0];
  return g?.getAttribute('prst') ?? null;
}

async function readNotes(zip: JSZip, slidePath: string): Promise<string> {
  const relsPath = slidePath.replace(/slides\/(slide\d+\.xml)$/i, 'slides/_rels/$1.rels');
  const rels = await fileString(zip, relsPath);
  if (!rels) return '';
  const m = rels.match(/Target="[^"]*notesSlide(\d+)\.xml"/i);
  if (!m) return '';
  const notesXmlStr = await fileString(zip, `ppt/notesSlides/notesSlide${m[1]}.xml`);
  if (!notesXmlStr) return '';
  const doc = parseXml(notesXmlStr);
  const out: string[] = [];
  for (const p of local(doc, 'p').filter((n) => n.namespaceURI?.includes('drawingml'))) {
    // Drop paragraphs that are only a slide-number field.
    const flds = local(p, 'fld');
    const isSlideNum = flds.some((f) => f.getAttribute('type') === 'slidenum');
    const text = local(p, 't').map((t) => t.textContent ?? '').join('');
    if (!isSlideNum && text.trim()) out.push(text.trim());
  }
  return out.join('\n');
}

async function imageDataUrl(zip: JSZip, slidePath: string, rId: string): Promise<string | null> {
  const relsPath = slidePath.replace(/slides\/(slide\d+\.xml)$/i, 'slides/_rels/$1.rels');
  const rels = await fileString(zip, relsPath);
  if (!rels) return null;
  const re = new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`);
  const m = rels.match(re);
  if (!m) return null;
  const target = m[1].replace(/^\.\.\//, 'ppt/');
  const file = zip.files[target] || zip.files[target.replace(/^ppt\//, 'ppt/')];
  if (!file) return null;
  const ext = (target.split('.').pop() || 'png').toLowerCase();
  const mime =
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'gif' ? 'image/gif' :
    ext === 'svg' ? 'image/svg+xml' :
    ext === 'webp' ? 'image/webp' : 'image/png';
  const b64 = await file.async('base64');
  return `data:${mime};base64,${b64}`;
}

// Full DrawingML shadow: outerShdw/innerShdw carry blurRad/dist (EMU),
// dir (60000ths of a degree) and a color child with an alpha. Imported to
// the block-level ShadowSpec so decks keep their real shadow, not a
// hardcoded soft one.
function readShadow(node: Element, theme: ThemeColors): ShadowSpec | undefined {
  const spPr = local(node, 'spPr')[0];
  if (!spPr) return undefined;
  const outer = local(spPr, 'outerShdw')[0];
  const innerEl = local(spPr, 'innerShdw')[0];
  const sh = outer ?? innerEl;
  if (!sh) return undefined;
  const color = resolveColorEl(sh, theme) ?? '#000000';
  const alpha = local(sh, 'alpha')[0]?.getAttribute('val');
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    inner: sh === innerEl || undefined,
    color,
    opacity: alpha ? Number(alpha) / 100000 : 0.5,
    blur: r1(Number(sh.getAttribute('blurRad') ?? 0) / EMU),
    distance: r1(Number(sh.getAttribute('dist') ?? 0) / EMU),
    angle: Math.round(Number(sh.getAttribute('dir') ?? 0) / 60000)
  };
}

// Click hyperlinks found on shapes, resolved into goToSlide triggers after
// every slide exists (forward links need the target slide's generated id).
interface PendingLink { blockId: string; slideNum?: number; jump?: 'next' | 'prev' | 'first' | 'last' }

// Per-slide import context: DrawingML shape ids -> our block ids (timing
// nodes and interactive triggers target shapes by spid), plus hyperlinks.
interface SlideCtx { idMap: Map<string, string>; links: PendingLink[]; rels: string | null }

function readHlink(node: Element, ctx: SlideCtx, blockId: string): void {
  const hl = local(node, 'hlinkClick')[0];
  if (!hl) return;
  const action = hl.getAttribute('action') ?? '';
  if (action.includes('jump=nextslide')) { ctx.links.push({ blockId, jump: 'next' }); return; }
  if (action.includes('jump=previousslide')) { ctx.links.push({ blockId, jump: 'prev' }); return; }
  if (action.includes('jump=firstslide')) { ctx.links.push({ blockId, jump: 'first' }); return; }
  if (action.includes('jump=lastslide')) { ctx.links.push({ blockId, jump: 'last' }); return; }
  const rId = hl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    ?? hl.getAttribute('r:id');
  if (!rId || !ctx.rels) return;
  const m = ctx.rels.match(new RegExp(`Id="${rId}"[^>]*Target="[^"]*slide(\\d+)\\.xml"`));
  if (m) ctx.links.push({ blockId, slideNum: Number(m[1]) });
}

async function importShape(
  zip: JSZip, slidePath: string, node: Element,
  groupOffset: { dx: number; dy: number },
  layout: { spMap: Map<PhKey, Element>; bgFill: string | null },
  theme: ThemeColors,
  out: Block[],
  usedFonts: Set<string>,
  ctx: SlideCtx
): Promise<void> {
  const before = out.length;
  const spid = local(node, 'cNvPr')[0]?.getAttribute('id');
  await importShapeInner(zip, slidePath, node, groupOffset, layout, theme, out, usedFonts);
  const created = out.slice(before);
  if (!created.length) return;
  // The visual block (shape/image) is the animation/click target; a
  // text-only sp maps to its text block.
  const primary = created.find((b) => b.type !== 'text') ?? created[0];
  if (spid) ctx.idMap.set(spid, primary.id);
  readHlink(node, ctx, primary.id);
}

async function importShapeInner(
  zip: JSZip, slidePath: string, node: Element,
  groupOffset: { dx: number; dy: number },
  layout: { spMap: Map<PhKey, Element>; bgFill: string | null },
  theme: ThemeColors,
  out: Block[],
  usedFonts: Set<string>
): Promise<void> {
  const name = node.localName;

  let xfrm = readXfrm(node);
  let layoutSp: Element | undefined;
  const ph = local(node, 'ph')[0];
  if (ph) {
    layoutSp = layout.spMap.get(phKey(ph)) ?? layout.spMap.get(`${ph.getAttribute('type') ?? 'body'}|`);
    if (!xfrm && layoutSp) xfrm = readXfrm(layoutSp);
  }
  if (name === 'pic') {
    const blip = local(node, 'blip')[0];
    const rId = blip?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed')
      ?? blip?.getAttribute('r:embed') ?? blip?.getAttribute('r:link');
    if (!rId) return;
    const src = await imageDataUrl(zip, slidePath, rId);
    if (!src) return;
    const f = xfrm ?? { x: 80, y: 80, w: 360, h: 240 };
    const picShadow = readShadow(node, theme);
    out.push({
      id: uid('blk'), type: 'image',
      x: Math.round(f.x + groupOffset.dx), y: Math.round(f.y + groupOffset.dy),
      w: Math.max(24, Math.round(f.w)), h: Math.max(24, Math.round(f.h)),
      props: { src, fit: 'contain', alt: '' },
      ...(picShadow ? { shadow: picShadow } : {})
    } as Block);
    return;
  }

  if (name === 'sp' || name === 'cxnSp') {
    const { html, fontSize, bold, font, color: runColor, align, valign, lineHeight } = parseTextBodyHtml(node, theme, layoutSp);
    const prst = prstGeomOf(node);
    const isConnector = name === 'cxnSp' || prst === 'line' || prst === 'straightConnector1' || prst === 'bentConnector3' || prst === 'curvedConnector3';
    
    const f = xfrm ?? { x: 80, y: 80, w: 500, h: 80 };
    const x = Math.round(f.x + groupOffset.dx);
    const y = Math.round(f.y + groupOffset.dy);
    const w = Math.max(8, Math.round(f.w));
    const h = Math.max(8, Math.round(f.h));
    const finalFontSize = fontSize || 18;

    const { fill, border, borderWidth } = fillOf(node, theme, layoutSp);
    const shadow = readShadow(node, theme);

    if (isConnector) {
      const xfrmEl = local(node, 'xfrm')[0];
      const flipH = xfrmEl?.getAttribute('flipH') === '1';
      const flipV = xfrmEl?.getAttribute('flipV') === '1';
      
      const originalW = xfrm ? xfrm.w : 500;
      const originalH = xfrm ? xfrm.h : 80;
      
      let x1 = flipH ? 100 : 0;
      let x2 = flipH ? 0 : 100;
      let y1 = flipV ? 100 : 0;
      let y2 = flipV ? 0 : 100;
      
      if (originalH < 2) {
        y1 = 50;
        y2 = 50;
      }
      if (originalW < 2) {
        x1 = 50;
        x2 = 50;
      }
      
      const points = `${x1},${y1} ${x2},${y2}`;
      
      // Line ends: DrawingML headEnd/tailEnd carry a type (triangle, stealth,
      // arrow=open, oval, diamond) and w/len size hints (sm|med|lg). headEnd
      // sits at the line's first point. Mapped 1:1 so round-tripping a deck
      // keeps its arrows, at PowerPoint's size instead of the old oversized
      // fixed marker.
      const ln = local(node, 'spPr')[0]?.getElementsByTagNameNS('*', 'ln')[0];
      const readEnd = (el: Element | undefined) => {
        const t = el?.getAttribute('type');
        if (!t || t === 'none') return undefined;
        const type =
          t === 'triangle' ? 'triangle'
          : t === 'stealth' ? 'stealth'
          : t === 'arrow' ? 'open'
          : t === 'oval' ? 'oval'
          : t === 'diamond' ? 'diamond'
          : 'triangle';
        const lenAttr = el?.getAttribute('len') ?? el?.getAttribute('w');
        const size = lenAttr === 'sm' ? 'sm' : lenAttr === 'lg' ? 'lg' : 'md';
        return { type, size } as const;
      };
      const lineStart = ln ? readEnd(local(ln, 'headEnd')[0]) : undefined;
      const lineEnd = ln ? readEnd(local(ln, 'tailEnd')[0]) : undefined;

      out.push({
        id: uid('blk'), type: 'shape', x, y, w, h,
        props: {
          kind: 'rectangle',
          fill: 'transparent',
          borderColor: border || '#1c222b',
          borderWidth: borderWidth || 2,
          cornerRadius: 0,
          points,
          isLine: true,
          ...(lineStart ? { lineStart } : {}),
          ...(lineEnd ? { lineEnd } : {})
        },
        ...(shadow ? { shadow } : {})
      } as Block);
      return;
    }

    const kind = prst ? PRSTGEOM_TO_KIND[prst] : undefined;
    const isTextBox = !prst || (prst === 'rect' && fill === 'transparent' && border === 'transparent');
    
    if (kind && !isTextBox) {
      out.push({
        id: uid('blk'), type: 'shape', x, y, w, h,
        props: { kind, fill, borderColor: border, borderWidth, cornerRadius: 12 },
        ...(shadow ? { shadow } : {})
      } as Block);
    }

    if (html) {
      const color = runColor ?? firstTextColor(node, theme);
      if (font) usedFonts.add(font);
      out.push({
        id: uid('blk'), type: 'text',
        x: kind && !isTextBox ? x + 8 : x,
        y: kind && !isTextBox ? y : y,
        w: Math.max(60, kind && !isTextBox ? w - 16 : w),
        h: Math.max(32, kind && !isTextBox ? h : h),
        props: {
          html,
          fontSize: Math.round(finalFontSize),
          align: align ?? (kind && !isTextBox ? 'center' : 'left'),
          valign: valign ?? (kind && !isTextBox ? 'center' : 'top'),
          // PowerPoint's single spacing (~1.2) unless the deck sets its own.
          lineHeight: lineHeight ?? 1.2,
          ...(color ? { color } : {}),
          ...(font ? { fontFamily: font } : {}),
          ...(bold ? { bold } : {})
        }
      } as Block);
    }
  }
}

function firstTextColor(sp: Element, theme: ThemeColors): string | null {
  for (const rPr of local(sp, 'rPr')) {
    const sf = local(rPr, 'solidFill')[0];
    if (sf) {
      const hex = resolveColorEl(sf, theme);
      if (hex) return hex;
    }
  }
  return null;
}

// PowerPoint animations -> our timeline ------------------------------------
// The p:timing tree nests effect cTn nodes (presetClass entr/exit, presetID
// = the gallery effect, presetSubtype = direction bits) inside a mainSeq.
// PowerPoint advances by click; our timeline has a clock, so click groups
// are laid out sequentially: each clickEffect starts when the previous
// group's longest effect ends. Interactive sequences ("start on click of
// shape X") become real triggers: hide the targets on slide load, show
// them when the source is clicked.

const directChild = (el: Element, name: string): Element | undefined =>
  Array.from(el.children).find((c) => c.localName === name);

function effectDelaySec(eff: Element): number {
  const st = directChild(eff, 'stCondLst');
  const d = st ? directChild(st, 'cond')?.getAttribute('delay') : null;
  return d && d !== 'indefinite' ? Number(d) / 1000 : 0;
}

function effectDurSec(eff: Element): number {
  let max = 0;
  for (const c of local(eff, 'cTn')) {
    const dur = c.getAttribute('dur');
    if (dur && dur !== 'indefinite') max = Math.max(max, Number(dur) / 1000);
  }
  return max || 0.5;
}

// Fly-in style subtype bits: 1=from top, 2=from right, 4=from bottom,
// 8=from left (corners are sums; the dominant bit wins).
function subtypeDirection(sub: number): AnimDirection {
  if (sub & 4) return 'up';    // enters FROM the bottom, moving up
  if (sub & 1) return 'down';
  if (sub & 8) return 'right';
  if (sub & 2) return 'left';
  return 'up';
}

function mapPresetToAnim(eff: Element, durSec: number): AnimSpec | null {
  const presetId = Number(eff.getAttribute('presetID') ?? 0);
  const sub = Number(eff.getAttribute('presetSubtype') ?? 0);
  const dur = Math.max(0.1, durSec);
  const spec = (type: AnimSpec['type'], extra: Partial<AnimSpec> = {}): AnimSpec =>
    ({ type, duration: dur, ease: 'power2.out', ...extra });
  switch (presetId) {
    case 1: return spec('fade', { duration: 0.1 });        // Appear
    case 2: return spec('slide', { direction: subtypeDirection(sub), distance: 300 }); // Fly In
    case 10: return spec('fade');                           // Fade
    case 14: return spec('slide', { direction: subtypeDirection(sub) }); // Peek In
    case 23: {                                              // Wipe
      // The animEffect filter names the direction outright: wipe(up)...
      const filter = local(eff, 'animEffect')[0]?.getAttribute('filter') ?? '';
      const m = /wipe\((up|down|left|right)\)/i.exec(filter);
      return spec('wipe', { direction: (m?.[1]?.toLowerCase() as AnimDirection) ?? subtypeDirection(sub) });
    }
    case 26: case 53: return spec('zoom');                  // Zoom / Faded zoom
    case 34: case 47: return spec('rise', { ease: 'power3.out' }); // Rise Up / Ascend
    case 30: return spec('zoomOut');                        // Shrink-ish
    case 54: return spec('flip', { direction: 'left' });    // Flip
    case 56: return spec('bounceIn');                       // Bounce
    default: return spec('fade');                           // everything else approximates as a fade
  }
}

interface TimingResult { animated: boolean; endsAt: number }

function importTiming(
  doc: Document,
  idMap: Map<string, string>,
  blocks: Block[],
  triggers: Trigger[],
  warnings: string[],
  slideNum: number
): TimingResult {
  const timing = local(doc, 'timing')[0];
  if (!timing) return { animated: false, endsAt: 0 };
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const target = (eff: Element): Block | undefined => {
    const spid = local(eff, 'spTgt')[0]?.getAttribute('spid');
    const id = spid ? idMap.get(spid) : undefined;
    return id ? byId.get(id) : undefined;
  };

  let animated = false;
  let endsAt = 0;

  for (const seq of local(timing, 'seq')) {
    const seqCtn = directChild(seq, 'cTn');
    if (!seqCtn) continue;
    const isMain = seqCtn.getAttribute('nodeType') === 'mainSeq';
    const effects = local(seqCtn, 'cTn').filter((c) => c.getAttribute('presetClass'));

    if (isMain) {
      // Sequential click groups on the timeline clock.
      let clock = 0;      // current group's base time
      let groupEnd = 0;   // when the current group's longest effect ends
      let lastStart = 0;
      for (const eff of effects) {
        const cls = eff.getAttribute('presetClass');
        const nodeType = eff.getAttribute('nodeType');
        const b = target(eff);
        const durSec = effectDurSec(eff);
        if (nodeType === 'clickEffect' || nodeType === 'afterEffect') clock = groupEnd;
        const start = (nodeType === 'withEffect' ? lastStart : clock) + effectDelaySec(eff);
        lastStart = start;
        groupEnd = Math.max(groupEnd, start + durSec);
        endsAt = Math.max(endsAt, start + durSec);
        if (!b) continue;
        if (cls === 'entr') {
          const anim = mapPresetToAnim(eff, durSec);
          b.timing = { ...(b.timing ?? {}), start: Math.round(start * 10) / 10, animIn: anim ?? undefined };
          animated = true;
        } else if (cls === 'exit') {
          const anim = mapPresetToAnim(eff, durSec);
          const end = Math.round((start + durSec) * 10) / 10;
          b.timing = { ...(b.timing ?? { start: 0 }), end, animOut: anim ?? undefined };
          animated = true;
        } else {
          warnings.push(`Slide ${slideNum}: an ${cls} animation was skipped (only entrance/exit import).`);
        }
      }
    } else {
      // Interactive sequence: effects start on a click of a source shape.
      const condTgt = local(seq, 'cond').map((c) => local(c, 'spTgt')[0]).find(Boolean);
      const srcId = condTgt?.getAttribute('spid') ? idMap.get(condTgt.getAttribute('spid')!) : undefined;
      const shown = effects.filter((e) => e.getAttribute('presetClass') === 'entr').map(target).filter(Boolean) as Block[];
      const hidden = effects.filter((e) => e.getAttribute('presetClass') === 'exit').map(target).filter(Boolean) as Block[];
      if (!srcId || (!shown.length && !hidden.length)) continue;
      // Click-revealed blocks start hidden, then the click shows them.
      for (const b of shown) {
        triggers.push({ id: uid('trg'), event: 'onSlideLoad', conditions: [], actions: [{ type: 'hideBlock', blockId: b.id }] });
      }
      triggers.push({
        id: uid('trg'),
        event: 'onClick',
        sourceBlockId: srcId,
        conditions: [],
        actions: [
          ...shown.map((b) => ({ type: 'showBlock', blockId: b.id } as const)),
          ...hidden.map((b) => ({ type: 'hideBlock', blockId: b.id } as const))
        ]
      });
      animated = true;
    }
  }
  return { animated, endsAt };
}

export interface PptxImportResult {
  project: Project;
  warnings: string[];
}

export async function importPptx(file: File, existingTitle?: string): Promise<PptxImportResult> {
  const zip = await JSZip.loadAsync(file);
  const warnings: string[] = [];

  // Slide size
  let width = 1280;
  let height = 720;
  const presXml = await fileString(zip, 'ppt/presentation.xml');
  if (presXml) {
    const m = presXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    if (m) {
      width = Math.round(Number(m[1]) / EMU);
      height = Math.round(Number(m[2]) / EMU);
    }
  }

  // Slide files, numerically sorted; count cross-checked against sldIds.
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)![1]) - Number(b.match(/slide(\d+)/i)![1]));
  const fromPres = (presXml?.match(/<p:sldId /g) || []).length;
  if (fromPres > slidePaths.length) {
    warnings.push(`presentation.xml lists ${fromPres} slides but ${slidePaths.length} slide files were found.`);
  }
  if (slidePaths.length === 0) throw new Error('No slides found - is this a .pptx file?');

  const theme = await readTheme(zip);
  // Embedded fonts come first: families the deck ships keep their real
  // names (the @font-face wins); everything else may substitute to a
  // metric-compatible Google font via mapFont().
  const embeddedFonts = await readEmbeddedFonts(zip, presXml ?? '');
  EMBEDDED_FAMILIES = new Set(embeddedFonts.map((f) => f.family.toLowerCase()));
  SEEN_FONTS = new Set();
  // Fonts the deck actually uses (for the Google Fonts <link>).
  const usedFonts = new Set<string>();
  const slides: Slide[] = [];
  const slideLinks: PendingLink[][] = []; // per slide, resolved after all exist
  for (const path of slidePaths) {
    const xmlStr = await fileString(zip, path);
    if (!xmlStr) continue;
    const doc = parseXml(xmlStr);
    const spTree = local(doc, 'spTree')[0];
    const blocks: Block[] = [];

    const layout = await readLayout(zip, path, theme);
    const relsPath = path.replace(/slides\/(slide\d+\.xml)$/i, 'slides/_rels/$1.rels');
    const ctx: SlideCtx = { idMap: new Map(), links: [], rels: await fileString(zip, relsPath) };
    const walk = async (parent: Element, offset: { dx: number; dy: number }) => {
      for (const child of Array.from(parent.children)) {
        if (child.localName === 'AlternateContent') {
          // mc:AlternateContent wraps newer shapes; the Fallback branch is
          // the plain-OOXML rendering, so walk that (Choice may need
          // extensions we do not implement).
          const fb = local(child, 'Fallback')[0] ?? local(child, 'Choice')[0];
          if (fb) await walk(fb, offset);
        } else if (child.localName === 'grpSp') {
          // PowerPoint groups stay GROUPS: children import in the group's
          // child coordinate space, transform through chOff/chExt (groups
          // can scale their contents), and land in a real group block so
          // they keep moving/scaling/animating together.
          const gx = readXfrm(child);
          const grpXfrm = local(child, 'xfrm')[0];
          const chOff = grpXfrm ? local(grpXfrm, 'chOff')[0] : null;
          const chExt = grpXfrm ? local(grpXfrm, 'chExt')[0] : null;
          if (gx && chOff && chExt) {
            const inner: Block[] = [];
            for (const gchild of Array.from(child.children)) {
              if (gchild.localName === 'sp' || gchild.localName === 'pic' || gchild.localName === 'cxnSp') {
                await importShape(zip, path, gchild, { dx: 0, dy: 0 }, layout, theme, inner, usedFonts, ctx);
              } else if (gchild.localName === 'grpSp') {
                // Nested groups flatten into this one (rare; keeps this simple).
                const ngx = readXfrm(gchild);
                const nOff = local(gchild, 'chOff')[0];
                const dx = ngx && nOff ? ngx.x - Number(nOff.getAttribute('x')) / EMU : 0;
                const dy = ngx && nOff ? ngx.y - Number(nOff.getAttribute('y')) / EMU : 0;
                for (const nchild of Array.from(gchild.children)) {
                  if (nchild.localName === 'sp' || nchild.localName === 'pic' || nchild.localName === 'cxnSp') {
                    await importShape(zip, path, nchild, { dx, dy }, layout, theme, inner, usedFonts, ctx);
                  }
                }
              }
            }
            const ox = Number(chOff.getAttribute('x')) / EMU;
            const oy = Number(chOff.getAttribute('y')) / EMU;
            const sx = gx.w / Math.max(1, Number(chExt.getAttribute('cx')) / EMU);
            const sy = gx.h / Math.max(1, Number(chExt.getAttribute('cy')) / EMU);
            for (const b of inner) {
              b.x = Math.round((b.x - ox) * sx);
              b.y = Math.round((b.y - oy) * sy);
              b.w = Math.max(8, Math.round(b.w * sx));
              b.h = Math.max(8, Math.round(b.h * sy));
            }
            if (inner.length) {
              blocks.push({
                id: uid('grp'), type: 'group',
                name: local(child, 'cNvPr')[0]?.getAttribute('name') || 'Group',
                x: Math.round(gx.x + offset.dx), y: Math.round(gx.y + offset.dy),
                w: Math.max(8, Math.round(gx.w)), h: Math.max(8, Math.round(gx.h)),
                props: { blocks: inner }
              } as Block);
            }
          } else {
            // No usable transform: fall back to flattening with offsets.
            const chOff2 = local(child, 'chOff')[0];
            const dx = gx && chOff2 ? gx.x - Number(chOff2.getAttribute('x')) / EMU : 0;
            const dy = gx && chOff2 ? gx.y - Number(chOff2.getAttribute('y')) / EMU : 0;
            await walk(child, { dx: offset.dx + dx, dy: offset.dy + dy });
          }
        } else if (child.localName === 'sp' || child.localName === 'pic' || child.localName === 'cxnSp') {
          await importShape(zip, path, child, offset, layout, theme, blocks, usedFonts, ctx);
        } else if (child.localName === 'graphicFrame') {
          warnings.push(`Slide ${slides.length + 1}: a table/chart/SmartArt frame was skipped.`);
        }
      }
    };
    if (spTree) await walk(spTree, { dx: 0, dy: 0 });

    const layer = createLayer('Base layer', true);

    let bgHex = extractBgFill(local(doc, 'bg')[0], theme) || layout.bgFill;
    if (bgHex && bgHex !== 'transparent') {
      blocks.unshift({
        id: uid('blk'), type: 'shape', x: 0, y: 0, w: width, h: height,
        props: { kind: 'rectangle', fill: bgHex, borderColor: 'transparent', borderWidth: 0, cornerRadius: 0 }
      } as Block);
    }

    layer.blocks = blocks;
    const notes = await readNotes(zip, path);
    const n = slides.length + 1;

    // Animations + interactive (click-triggered) effects from p:timing.
    const triggers: Trigger[] = [];
    const anim = importTiming(doc, ctx.idMap, blocks, triggers, warnings, n);

    // Timeline: narration estimate when there are notes; otherwise long
    // enough for the imported animations to play out.
    let timeline = notes
      ? { duration: Math.max(3, Math.round(narrationEstimate(notes))), autoAdvance: true }
      : undefined;
    if (!timeline && anim.animated && anim.endsAt > 0) {
      timeline = { duration: Math.max(3, Math.ceil(anim.endsAt + 1)), autoAdvance: false };
    }

    slides.push({
      id: uid('sl'),
      name: `Slide ${n}`,
      width, height,
      layers: [layer],
      triggers,
      notes: notes || undefined,
      timeline
    });
    slideLinks.push(ctx.links);
    if (blocks.length === 0) warnings.push(`Slide ${n}: nothing importable (shapes may rely on layout placeholders).`);
  }

  // Hyperlink jumps become onClick goToSlide triggers now that every slide
  // (and its generated id) exists.
  slides.forEach((slide, i) => {
    for (const link of slideLinks[i] ?? []) {
      const idx =
        link.jump === 'next' ? i + 1 :
        link.jump === 'prev' ? i - 1 :
        link.jump === 'first' ? 0 :
        link.jump === 'last' ? slides.length - 1 :
        (link.slideNum ?? 0) - 1;
      const targetSlide = slides[idx];
      if (!targetSlide || targetSlide.id === slide.id) continue;
      slide.triggers.push({
        id: uid('trg'),
        event: 'onClick',
        sourceBlockId: link.blockId,
        conditions: [],
        actions: [{ type: 'goToSlide', slideId: targetSlide.id }]
      });
    }
  });

  const title = existingTitle || file.name.replace(/\.pptx$/i, '');
  return {
    project: {
      id: uid('prj'),
      title,
      slides,
      variables: [],
      completion: { mode: 'allSlides' },
      fonts: [...new Set([...usedFonts, ...SEEN_FONTS])].filter((f) => !embeddedFonts.some((e) => e.family === f)),
      embeddedFonts: embeddedFonts.length ? embeddedFonts : undefined
    },
    warnings
  };
}

// Pull any fonts the PowerPoint embedded (ppt/fonts/*.fntdata) so the deck's
// own typefaces render without depending on Google Fonts. Each style maps to
// an @font-face via a data URL. PowerPoint stores these as obfuscated or
// plain font files; modern .pptx uses standard TTF/OTF which browsers load
// directly through FontFace/@font-face.
async function readEmbeddedFonts(
  zip: JSZip,
  presXml: string
): Promise<{ family: string; dataUrl: string; weight?: number; italic?: boolean }[]> {
  const out: { family: string; dataUrl: string; weight?: number; italic?: boolean }[] = [];
  if (!presXml.includes('embeddedFont')) return out;
  const presRels = await fileString(zip, 'ppt/_rels/presentation.xml.rels');
  if (!presRels) return out;
  const relDoc = parseXml(presRels);
  const relMap = new Map<string, string>();
  for (const rel of local(relDoc, 'Relationship')) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) relMap.set(id, target.replace(/^\.\.\//, '').replace(/^\//, ''));
  }
  const doc = parseXml(presXml);
  const styles: [string, number, boolean][] = [
    ['regular', 400, false], ['bold', 700, false], ['italic', 400, true], ['boldItalic', 700, true]
  ];
  for (const ef of local(doc, 'embeddedFont')) {
    const family = local(ef, 'font')[0]?.getAttribute('typeface');
    if (!family) continue;
    for (const [tag, weight, italic] of styles) {
      const node = Array.from(ef.children).find((c) => c.localName === tag);
      const rid = node?.getAttribute('r:id') || node?.getAttributeNS('*', 'id');
      if (!rid) continue;
      const target = relMap.get(rid);
      if (!target) continue;
      const path = target.startsWith('ppt/') ? target : `ppt/${target}`;
      const f = zip.file(path) ?? zip.file(target);
      if (!f) continue;
      try {
        const b64 = await f.async('base64');
        // .fntdata is font binary; declare as font/otf which browsers sniff.
        out.push({ family, dataUrl: `data:font/otf;base64,${b64}`, weight, italic });
      } catch { /* skip unreadable font */ }
    }
  }
  return out;
}
