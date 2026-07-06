import JSZip from 'jszip';
import type { Block, Project, Slide } from '../schema/types';
import { createLayer, uid } from '../schema/factory';
import { ttsEstimate } from '../runtime/tts';
import { PRSTGEOM_TO_KIND } from '../blocks/shape/geometry';

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

function parseParagraphHtml(p: Element, theme: ThemeColors): string {
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
          style += `font-size: ${Math.round(sz / 100)}px;`;
        }
        
        const latin = local(rPr, 'latin')[0]?.getAttribute('typeface');
        if (latin && !latin.startsWith('+')) {
          style += `font-family: ${latin};`;
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

function parseTextBodyHtml(sp: Element, theme: ThemeColors, layoutSp?: Element): { html: string; fontSize: number | null; bold: boolean; font: string | null; color: string | null; align: string | null } {
  const txBody = local(sp, 'txBody')[0];
  const target = txBody ?? sp;
  const paras = local(target, 'p').filter((p) => p.namespaceURI?.includes('drawingml'));
  const htmlParas: string[] = [];
  
  let size: number | null = null;
  let bold = false;
  let font: string | null = null;
  let color: string | null = null;
  let align: string | null = null;
  
  // Scan all defRPr elements under the target (list styles, body defaults) for block-level fallbacks
  for (const defRPr of local(target, 'defRPr')) {
    if (defRPr.getAttribute('b') === '1') bold = true;
    if (!font) {
      const defLatin = local(defRPr, 'latin')[0]?.getAttribute('typeface');
      if (defLatin && !defLatin.startsWith('+')) font = defLatin;
    }
    if (!color) {
      const defSf = local(defRPr, 'solidFill')[0];
      if (defSf) color = resolveColorEl(defSf, theme);
    }
    if (!size) {
      const defSz = Number(defRPr.getAttribute('sz'));
      if (defSz) size = defSz / 100;
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

    const pHtml = parseParagraphHtml(p, theme);
    if (pHtml) {
      let pStyle = '';
      if (pAlign) pStyle += `text-align: ${pAlign};`;
      
      const defRPr = pPr ? local(pPr, 'defRPr')[0] : null;
      if (defRPr) {
        if (defRPr.getAttribute('b') === '1') pStyle += `font-weight: bold;`;
        
        const sz = Number(defRPr.getAttribute('sz'));
        if (sz) pStyle += `font-size: ${Math.round(sz / 100)}px;`;
        
        const sf = local(defRPr, 'solidFill')[0];
        if (sf) {
          const pColor = resolveColorEl(sf, theme);
          if (pColor) pStyle += `color: ${pColor};`;
        }
        
        const latin = local(defRPr, 'latin')[0]?.getAttribute('typeface');
        if (latin && !latin.startsWith('+')) {
          pStyle += `font-family: ${latin};`;
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
    if (sz && !size) size = sz / 100;
    if (rPr.getAttribute('b') === '1') bold = true;
  }
  
  if (layoutSp) {
    const l = parseTextBodyHtml(layoutSp, theme);
    if (!size) size = l.fontSize;
    if (!bold) bold = l.bold;
    if (!font) font = l.font;
    if (!color) color = l.color;
    if (!align) align = l.align;
  }
  
  return {
    html: htmlParas.join(''),
    fontSize: size,
    bold,
    font,
    color,
    align
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

function hasShadow(node: Element): boolean {
  const spPr = local(node, 'spPr')[0];
  if (!spPr) return false;
  const outerShdw = local(spPr, 'outerShdw')[0];
  return !!outerShdw;
}

async function importShape(
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
    out.push({
      id: uid('blk'), type: 'image',
      x: Math.round(f.x + groupOffset.dx), y: Math.round(f.y + groupOffset.dy),
      w: Math.max(24, Math.round(f.w)), h: Math.max(24, Math.round(f.h)),
      props: { src, fit: 'contain', alt: '' }
    } as Block);
    return;
  }

  if (name === 'sp' || name === 'cxnSp') {
    const { html, fontSize, bold, font, color: runColor, align } = parseTextBodyHtml(node, theme, layoutSp);
    const prst = prstGeomOf(node);
    const isConnector = name === 'cxnSp' || prst === 'line' || prst === 'straightConnector1' || prst === 'bentConnector3' || prst === 'curvedConnector3';
    
    const f = xfrm ?? { x: 80, y: 80, w: 500, h: 80 };
    const x = Math.round(f.x + groupOffset.dx);
    const y = Math.round(f.y + groupOffset.dy);
    const w = Math.max(8, Math.round(f.w));
    const h = Math.max(8, Math.round(f.h));
    const finalFontSize = fontSize || 18;

    const { fill, border, borderWidth } = fillOf(node, theme, layoutSp);
    const shadow = hasShadow(node);

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
      
      const ln = local(node, 'spPr')[0]?.getElementsByTagNameNS('*', 'ln')[0];
      let arrow: 'none' | 'start' | 'end' | 'both' = 'none';
      if (ln) {
        const headEnd = local(ln, 'headEnd')[0];
        const tailEnd = local(ln, 'tailEnd')[0];
        const hasHead = headEnd && headEnd.getAttribute('type') && headEnd.getAttribute('type') !== 'none';
        const hasTail = tailEnd && tailEnd.getAttribute('type') && tailEnd.getAttribute('type') !== 'none';
        if (hasHead && hasTail) arrow = 'both';
        else if (hasHead) arrow = 'start';
        else if (hasTail) arrow = 'end';
      }

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
          arrow,
          ...(shadow ? { shadow } : {})
        }
      } as Block);
      return;
    }

    const kind = prst ? PRSTGEOM_TO_KIND[prst] : undefined;
    const isTextBox = !prst || (prst === 'rect' && fill === 'transparent' && border === 'transparent');
    
    if (kind && !isTextBox) {
      out.push({
        id: uid('blk'), type: 'shape', x, y, w, h,
        props: { kind, fill, borderColor: border, borderWidth, cornerRadius: 12, ...(shadow ? { shadow } : {}) }
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
          valign: kind && !isTextBox ? 'center' : 'top',
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
  // Fonts the deck actually uses (for embedding) and any font files the deck
  // itself embeds (ppt/fonts/*.fntdata).
  const usedFonts = new Set<string>();
  const slides: Slide[] = [];
  for (const path of slidePaths) {
    const xmlStr = await fileString(zip, path);
    if (!xmlStr) continue;
    const doc = parseXml(xmlStr);
    const spTree = local(doc, 'spTree')[0];
    const blocks: Block[] = [];

    const layout = await readLayout(zip, path, theme);
    const walk = async (parent: Element, offset: { dx: number; dy: number }) => {
      for (const child of Array.from(parent.children)) {
        if (child.localName === 'AlternateContent') {
          // mc:AlternateContent wraps newer shapes; the Fallback branch is
          // the plain-OOXML rendering, so walk that (Choice may need
          // extensions we do not implement).
          const fb = local(child, 'Fallback')[0] ?? local(child, 'Choice')[0];
          if (fb) await walk(fb, offset);
        } else if (child.localName === 'grpSp') {
          const gx = readXfrm(child);
          const chOff = local(child, 'chOff')[0];
          const dx = gx && chOff ? gx.x - Number(chOff.getAttribute('x')) / EMU : 0;
          const dy = gx && chOff ? gx.y - Number(chOff.getAttribute('y')) / EMU : 0;
          await walk(child, { dx: offset.dx + dx, dy: offset.dy + dy });
        } else if (child.localName === 'sp' || child.localName === 'pic' || child.localName === 'cxnSp') {
          await importShape(zip, path, child, offset, layout, theme, blocks, usedFonts);
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
    slides.push({
      id: uid('sl'),
      name: `Slide ${n}`,
      width, height,
      layers: [layer],
      triggers: [],
      notes: notes || undefined,
      // Narrator behavior: slides with speaker notes get a pre-estimated timeline
      // duration but do not auto-run browser-side TTS.
      timeline: notes
        ? { duration: Math.max(3, Math.round(ttsEstimate(notes, 1))), autoAdvance: true }
        : undefined
    });
    if (blocks.length === 0) warnings.push(`Slide ${n}: nothing importable (shapes may rely on layout placeholders).`);
  }

  const title = existingTitle || file.name.replace(/\.pptx$/i, '');
  const embeddedFonts = await readEmbeddedFonts(zip, presXml ?? '');
  return {
    project: {
      id: uid('prj'),
      title,
      slides,
      variables: [],
      completion: { mode: 'allSlides' },
      fonts: [...usedFonts].filter((f) => !embeddedFonts.some((e) => e.family === f)),
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
