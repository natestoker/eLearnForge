import JSZip from 'jszip';
import type { Action, AnimSpec, Block, Condition, Layer, Project, Slide, Trigger, Variable } from '../schema/types';
import { STORY_SHELL_BASE64 } from './storyShell';
import { md5 } from './md5';
import { DRAG_DROP_INTR, PICK_MANY_INTR, PICK_ONE_INTR } from './storyQuizTemplates';

// Save a project as an Articulate Storyline 360 file.
//
// A .story is a zip of XML that only Storyline fully defines, so this starts
// from a blank project saved by Storyline (storyShell.ts) and swaps in the
// project's slides. Every element written here copies the shape of one seen
// in a real Storyline file; nothing is invented. What Storyline has no room
// for (quiz blocks, sliders, effects) is left out and listed in the warnings,
// with an outlined box where the object was.
//
// Written: slides, layers, text boxes, pictures, rectangles / rounded
// rectangles / ovals / triangles, lines, buttons (as rounded rectangles),
// timing, common entrance animations, notes, variables, and the triggers that
// have a confirmed Storyline form.

export interface StoryExportResult { blob: Blob; warnings: string[] }

const ZERO = '00000000-0000-0000-0000-000000000000';
const PX_TO_PT = 3 / 4;
const BIG = '3.40282347E+38';
// Text with no font set uses the system UI font in eLearnForge; on Windows,
// where Storyline runs, that is Segoe UI. Naming it keeps line breaks close.
const DEFAULT_FONT = 'Segoe UI';
// Layouts in the shell project: the Question layout for quiz slides, and the
// fixed id Storyline gives every object state.
const QUESTION_LAYOUT_G = 'c15aab31-6ae0-4a46-b5d4-a187bf275b6c';
const STATE_LAYOUT_G = '7f817a98-1fec-49af-97a0-9a010cd18ba4';
// The blank layout Storyline gives new layers in the shell project.
const LAYER_LAYOUT_G = '24c85052-eec7-4a8e-81ec-40552db6ddd0';

function guid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function shortId(len: number, prefix = ''): string {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return prefix + Array.from(b, (v) => ALNUM[v % ALNUM.length]).join('');
}
// A part's id is not free-form: Storyline derives it from the object's GUID
// (the first eight bytes as a little-endian number, written in base 62 after
// an "R"). A picture has no other link to its file, so its file name must be
// exactly this or Storyline reports the asset as unreadable.
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export function partId(g: string): string {
  const p = g.split('-');
  let v = BigInt(`0x${p[0]}`) | (BigInt(`0x${p[1]}`) << 32n) | (BigInt(`0x${p[2]}`) << 48n);
  let out = '';
  while (v > 0n) { out = B62[Number(v % 62n)] + out; v /= 62n; }
  return `R${out}`;
}
const gv = () => `g="${guid()}" verG="${guid()}"`;
const xa = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => String(Math.round(v * 1000) / 1000);
const hex6 = (c: string | undefined, fallback: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec((c ?? '').trim()) ?? /^#?([0-9a-f]{3})$/i.exec((c ?? '').trim());
  if (!m) {
    const rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(c ?? '');
    if (rgb) return [rgb[1], rgb[2], rgb[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase();
    return fallback;
  }
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return h.toUpperCase();
};

// ---------- fixed fragments, copied from Storyline output ----------
const LINE_STYLE_NONE = '<lineStyle w="0" scale="0.75" cap="def" join="def" dash="cstm" cmpnd="cstm"><arrow scale="0.75"><begin type="def" sz="def" /><end type="def" sz="def" /></arrow></lineStyle>';
const GRAD_NONE = `<gradOvrlyFill type="def" style="def" rot="none" angle="${BIG}" blendMode="def" alpha="-1" scale="-1" reverse="none" adjustY="-2147483648" overlayFillType="Default"><centerPt x="-1" y="-1" /><fillRect l="0" t="0" r="0" b="0" /><stops /></gradOvrlyFill>`;
const SHDW_NONE = `<shdw sz="-${BIG}" blur="-${BIG}" angle="-${BIG}" dist="-${BIG}"><preset val="cstm" mode="cstm" /><clr /></shdw>`;
const BG_DEFAULT = `<bG>${LINE_STYLE_NONE}${GRAD_NONE}${SHDW_NONE}</bG>`;
const DIAL = `<dialData dialType="None" varG="${ZERO}" defVarG="${ZERO}" updateAction="drag" increment="1" rotation="180" rotationIndicatorOffsetDegrees="0" indicatorPaintMode="Always"><values start="0" end="12" /><rotationPoint xOffset="0" yOffset="0" /></dialData>`;
const SLIDE_BG = `<lineStyle w="0" scale="1" cap="def" join="def" dash="cstm" cmpnd="cstm"><arrow scale="1"><begin type="def" sz="def" /><end type="def" sz="def" /></arrow></lineStyle><gradOvrlyFill type="def" style="def" rot="none" angle="3.4028235E+38" blendMode="def" alpha="-1" scale="-1" reverse="none" adjustY="-2147483648" overlayFillType="Default"><centerPt x="-1" y="-1" /><fillRect l="0" t="0" r="0" b="0" /><stops /></gradOvrlyFill>`;

function paintBg(fill: string | null, line: string | null, lineW: number): string {
  const fillXml = fill ? `<solidFill><clr><srgbClr val="${fill}" /></clr></solidFill>` : '<noFill />';
  const lineXml = line && lineW > 0 ? `<solidLine><clr><srgbClr val="${line}" /></clr></solidLine>` : '<noLine />';
  const style = line && lineW > 0
    ? `<lineStyle w="${n(lineW * PX_TO_PT)}" scale="0.75" cap="flat" join="rnd" dash="sld" cmpnd="sng"><arrow scale="0.75"><begin type="def" sz="def" /><end type="def" sz="def" /></arrow></lineStyle>`
    : LINE_STYLE_NONE;
  return `<bG>${fillXml}${lineXml}${style}${GRAD_NONE}${SHDW_NONE}</bG>`;
}

// ---------- text ----------
interface Run { text: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; sup: boolean; color: string; size: number; font: string }
interface Para { runs: Run[]; align: string; list: '' | 'ul' | 'ol' }

function htmlToParas(html: string, base: { color: string; size: number; font: string; align: string; bold: boolean }): Para[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  const paras: Para[] = [];
  let cur: Para | null = null;
  const open = (align: string, list: Para['list']) => { cur = { runs: [], align, list }; paras.push(cur); return cur; };
  const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE']);

  const walk = (node: Node, st: Omit<Run, 'text'>, align: string, list: Para['list']) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (!text.trim() && !(cur && cur.runs.length)) return;
      (cur ?? open(align, list)).runs.push({ ...st, text });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (tag === 'BR') { (cur ?? open(align, list)).runs.push({ ...st, text: '\n' }); return; }
    const next = { ...st };
    if (tag === 'STRONG' || tag === 'B' || /^H[1-6]$/.test(tag)) next.bold = true;
    if (tag === 'EM' || tag === 'I') next.italic = true;
    if (tag === 'U') next.underline = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') next.strike = true;
    if (tag === 'SUP') next.sup = true;
    const s = el.style;
    if (s.color) next.color = hex6(s.color, next.color);
    if (s.fontSize && s.fontSize.endsWith('px')) next.size = parseFloat(s.fontSize);
    if (s.fontFamily) next.font = s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (s.fontWeight) next.bold = s.fontWeight === 'bold' || Number(s.fontWeight) >= 600;
    const nextAlign = s.textAlign || align;
    const nextList: Para['list'] = tag === 'UL' ? 'ul' : tag === 'OL' ? 'ol' : list;
    if (BLOCKS.has(tag)) { cur = null; open(nextAlign, tag === 'LI' ? nextList : ''); }
    el.childNodes.forEach((c) => walk(c, next, nextAlign, nextList));
    if (BLOCKS.has(tag)) cur = null;
  };
  walk(root, { bold: base.bold, italic: false, underline: false, strike: false, sup: false, color: base.color, size: base.size, font: base.font }, base.align, '');
  return paras.filter((p) => p.runs.length);
}

function documentXml(paras: Para[]): string {
  const just = (a: string) => (a === 'center' ? 'Center' : a === 'right' ? 'Right' : 'Left');
  const blocks = paras.map((p) => {
    const listType = p.list === 'ul' ? 'Bullet' : p.list === 'ol' ? 'ListNumberedAsArabic' : 'None';
    const fmt = p.list === 'ol' ? 'Period' : 'Plain';
    const style = `<Style LeadingMargin="0" FirstLineMargin="0" Justification="${just(p.align)}" ListLevel="1" LineSpacingRule="Multiple" LineSpacing="20" SpacingBefore="0" SpacingAfter="0"><ListStyle ListType="${listType}" ListTypeFormat="${fmt}" Start="0" Color="#000000,00" BulletChar="•" BulletFont="Arial"><BulletPicture Size="0x0" /></ListStyle></Style>`;
    const spans = p.runs.map((r) => {
      const c = `#${r.color}`;
      const b = (v: boolean) => (v ? 'True' : 'False');
      return `<Span Text="${xa(r.text).replace(/\n/g, '&#xA;')}"><Style FontFamily="${xa(r.font)}" FontSize="${n(r.size * PX_TO_PT)}" FontIsBold="${b(r.bold)}" FontIsItalic="${b(r.italic)}" FontIsUnderline="${b(r.underline)}" FontIsStrikeout="${b(r.strike)}" ForegroundColor="${c}" Elevation="${r.sup ? 'Superscript' : 'Normal'}" DisplayCase="AsIs" LinkColor="${c}" /></Span>`;
    }).join('');
    return `<Block>${style}${spans}</Block>`;
  }).join('');
  return `<Document xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Content>${blocks}</Content></Document>`;
}
const plainOf = (paras: Para[]) => paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n');

// ---------- animation ----------
function entranceXml(a: AnimSpec | undefined): string {
  if (!a || a.type === 'none') return '<animEffect />';
  const dur = `PT${n(a.duration || 0.75)}S`;
  const common = `dur="${dur}" lvl="none" easingDir="none" easingType="lin"`;
  const side = (d: string | undefined, fallback: string) => ({ up: 'b', down: 't', left: 'r', right: 'l' } as Record<string, string>)[d ?? ''] ?? fallback;
  let fx: string;
  switch (a.type) {
    case 'slide': case 'slideUp': case 'slideDown': case 'slideLeft': case 'slideRight':
      fx = `<fly dur="${dur}" lvl="none" easingDir="out" easingType="cubic" dir="${side(a.direction, 'b')}" />`; break;
    case 'rise': fx = `<float ${common} dir="asc" />`; break;
    case 'wipe': case 'wipeUp': fx = `<wipe ${common} dir="none" wd="${side(a.direction, 'l')}" />`; break;
    case 'grow': fx = `<growShrink ${common} dir="none" />`; break;
    default: fx = `<fade ${common} dir="none" />`;
  }
  return `<animEffect><entr>${fx}</entr></animEffect>`;
}

// ---------- export context ----------
interface Ctx {
  project: Project;
  w: number; h: number;
  warnings: Map<string, number>;
  slideG: Map<string, string>;
  layerG: Map<string, string>;
  blockG: Map<string, string>;
  varG: Map<string, string>;
  media: Map<string, { g: string; file: string; bytes: Uint8Array; hash: string; name: string }>; // by hash
  slideMedia: Set<string>; // media files used by the slide being written
  question: { layers: string } | null; // the quiz question on the slide being written, if any
  extraLayers: string;   // layers made for tabs on this slide
  addedLayers: number;   // how many layers this slide has gained
  showOnStart: string[]; // layers to show when the slide starts (a tab set's first panel)
}
const warn = (ctx: Ctx, msg: string) => ctx.warnings.set(msg, (ctx.warnings.get(msg) ?? 0) + 1);

async function toPng(src: string): Promise<Uint8Array | null> {
  try {
    if (/^data:image\/png;base64,/.test(src)) {
      const bin = atob(src.split(',')[1]);
      return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    }
    // Everything else is redrawn as PNG, the one picture type confirmed in
    // Storyline's media list.
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('image')); img.src = src; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || 300; c.height = img.naturalHeight || 150;
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const bin = atob(c.toDataURL('image/png').split(',')[1]);
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

async function mediaFor(ctx: Ctx, src: string, name: string): Promise<string | null> {
  const bytes = await toPng(src);
  if (!bytes) return null;
  const hash = md5(bytes);
  let m = ctx.media.get(hash);
  if (!m) {
    const g = guid();
    m = { g, file: `${partId(g)}.png`, bytes, hash, name: `${name.replace(/[\\/:*?"<>|]/g, '_') || 'Picture'}.png` };
    ctx.media.set(hash, m);
  }
  ctx.slideMedia.add(m.file);
  return m.g;
}

// ---------- shapes ----------
function tmCtx(kind: 'tmCtx' | 'txtTmCtx', b: Block, totalMs: number): string {
  const start = Math.max(0, Math.round((b.timing?.start ?? 0) * 1000));
  const end = b.timing?.end !== undefined ? Math.round(b.timing.end * 1000) : totalMs;
  const dur = Math.max(250, end - start);
  return `<tmProps ${gv()} cur="0" min="5000" visible="true" hideAll="false" /><tmCtxLst version="2"><${kind} ${gv()} start="${start}" dur="${dur}" min="250" max="0" hasMax="false" alwysShw="false" untilEnd="${b.timing?.end === undefined}" assetStart="0" name="" /></tmCtxLst>`;
}
const head = (b: Block, g: string, z: number, state: string, fallbackName: string) =>
  `g="${g}" verG="${guid()}" timeManagerVisibilityLocked="false" typeName="" id="-1" name="${xa(b.name || fallbackName)}" state="${state}" zOrder="${z}" editCtx="Normal" initState="" handCur="true" rot="${b.rotation ? n(((b.rotation % 360) + 360) % 360) : '-1'}" acc="true"`;
const locXml = (ctx: Ctx, b: Block) => `<sldSz w="${ctx.w}" h="${ctx.h}" /><loc l="${n(b.x)}" t="${n(b.y)}" r="${n(b.x + b.w)}" b="${n(b.y + b.h)}" />`;
const propBag = () => `<propBag><prop><key>morphKey</key><val><str>${shortId(11)}</str></val></prop></propBag>`;
const hLink = `<hLink enabled="false" trigG="${ZERO}" />`;

interface TextOpts { html: string; size: number; color: string; font: string; align: string; valign: string; bold: boolean; inset: { l: number; t: number; r: number; b: number } }
function textTail(b: Block, t: TextOpts | null): { text: string; tail: string } {
  if (!t) {
    return { text: '', tail: `${DIAL}<textMargin l="7" t="3" r="7" b="3" /><bounds l="0" t="0" r="0" b="0" /><resize fontNm="" fontSz="0" /><margins l="0" t="0" r="0" b="0" /><parLst /><plain></plain><hLinkLst />` };
  }
  const paras = htmlToParas(t.html, { color: t.color, size: t.size, font: t.font, align: t.align, bold: t.bold });
  const i = t.inset;
  return {
    text: `<text>${xa(documentXml(paras))}</text>`,
    tail: `${DIAL}<textMargin l="${n(i.l)}" t="${n(i.t)}" r="${n(i.r)}" b="${n(i.b)}" /><bounds l="${n(i.l)}" t="${n(i.t)}" r="${n(Math.max(i.l + 1, b.w - i.r))}" b="${n(Math.max(i.t + 1, b.h - i.b))}" /><resize fontNm="" fontSz="0" /><margins l="0" t="0" r="0" b="0" /><parLst /><plain>${xa(plainOf(paras))}</plain><hLinkLst />`
  };
}
const valignAttr = (v: string | undefined) => (v === 'center' ? 'm' : v === 'bottom' ? 'b' : 't');
const halignAttr = (a: string | undefined) => (a === 'center' ? 'c' : a === 'right' ? 'r' : 'l');

async function shapeXml(ctx: Ctx, b: Block, z: number, totalMs: number, trigs: string): Promise<string> {
  const g = ctx.blockG.get(b.id)!;
  const trigLst = trigs ? `<trigLst>${trigs}</trigLst>` : '<trigLst />';
  const anim = entranceXml(b.timing?.animIn);
  const p = b.props as unknown as Record<string, unknown>;

  if (b.type === 'text') {
    const inset = (p.inset ?? {}) as { top?: number; right?: number; bottom?: number; left?: number };
    const t = textTail(b, {
      html: String(p.html ?? ''), size: Number(p.fontSize) || 16, color: hex6(p.color as string, '000000'), font: String(p.fontFamily || DEFAULT_FONT),
      align: String(p.align ?? 'left'), valign: String(p.valign ?? 'top'), bold: Boolean(p.bold) || Number(p.fontWeight) >= 600,
      // eLearnForge pads every text block by 8px; Storyline's margin carries it.
      inset: { l: (inset.left ?? 0) + 8, t: (inset.top ?? 0) + 8, r: (inset.right ?? 0) + 8, b: (inset.bottom ?? 0) + 8 }
    });
    return `<textBox ${head(b, g, z, '110855', 'Text')} autoFit="resize" shdw="none" wrap="true" scrollOverflow="none" rtl="false" defHorzAlign="l" horzAlign="${halignAttr(p.align as string)}" vertAlign="${valignAttr(p.valign as string)}" textDir="not">${tmCtx('txtTmCtx', b, totalMs)}<childLst />${trigLst}<stateLst />${BG_DEFAULT}${locXml(ctx, b)}${anim}${hLink}${t.text}${propBag()}${t.tail}</textBox>`;
  }

  if (b.type === 'image') {
    const assetG = await mediaFor(ctx, String(p.src ?? ''), b.name || 'Picture');
    if (assetG) {
      return `<pic ${head(b, g, z, '110663', 'Picture')} assetG="${assetG}" imgSet="true" blend="srcCpy" useFileName="false" freeForm="false">${tmCtx('tmCtx', b, totalMs)}<childLst />${trigLst}<stateLst />${BG_DEFAULT}${locXml(ctx, b)}${anim}${hLink}${propBag()}${DIAL}<langAltText /><picFormat><offset /><tile /><sourceRect l="0" t="0" r="0" b="0" /><pic><brightness /><contrast /><recolor><clr /></recolor><blend><clr /></blend></pic></picFormat></pic>`;
    }
    warn(ctx, 'a picture could not be read and was left as an outline');
  }

  if (b.type === 'shape' && p.isLine) {
    const pts = String(p.points ?? '0,50 100,50').split(/\s+/).map((s) => s.split(',').map(Number));
    const [a, c] = [pts[0] ?? [0, 50], pts[pts.length - 1] ?? [100, 50]];
    const line: Block = { ...b, x: b.x + (a[0] / 100) * b.w, y: b.y + (a[1] / 100) * b.h, w: ((c[0] - a[0]) / 100) * b.w, h: ((c[1] - a[1]) / 100) * b.h };
    const t = textTail(line, null);
    return `<line ${head(b, g, z, '110855', 'Line')} autoFit="none" shdw="false" wrap="true" scrollOverflow="true" rtl="false" defHorzAlign="c" horzAlign="c" vertAlign="m" textDir="horz">${tmCtx('txtTmCtx', b, totalMs)}<childLst />${trigLst}<stateLst />${paintBg(null, hex6(p.borderColor as string, '000000'), Number(p.borderWidth) || 1)}${locXml(ctx, line)}${anim}${hLink}${propBag()}${t.tail}</line>`;
  }

  if (b.type === 'hotspot') {
    // Storyline's rectangular hotspot: an invisible click area. Copied from a
    // real one, including the green tint Storyline shows only while editing.
    const hotBg = `<bG shine="false"><marg l="1" t="1" r="1" b="1" /><solidFill><clr><srgbClr val="2F912F" /><alpha val="46666" /></clr></solidFill><solidLine><clr><srgbClr val="2F912F" /></clr></solidLine><lineStyle w="2" scale="1" cap="flat" join="rnd" dash="sld" cmpnd="sng"><arrow scale="1"><begin type="none" sz="size5" /><end type="none" sz="size5" /></arrow></lineStyle><gradOvrlyFill type="lin" style="lin" rot="true" angle="90" blendMode="ovrly" alpha="1" scale="1" reverse="false" adjustY="0" overlayFillType="None"><centerPt x="1" y="1" /><fillRect l="0" t="0" r="0" b="0" /><stops /></gradOvrlyFill><shdw sz="100" blur="5" angle="90" dist="5"><preset val="noShdw" mode="noShdw" /><clr><srgbClr val="000000" /><alpha val="42745" /></clr></shdw><reflection type="none" /><glow type="none" spread="0"><clr><srgbClr val="00205B" /></clr></glow><softEdge type="none" spread="0" /><foreClr><srgbClr val="FFFFFF" /></foreClr></bG>`;
    const emptyDoc = xa('<Document xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Content><Block><Style /></Block></Content></Document>');
    return `<clkAreaRect ${head(b, g, z, '107271', 'Rectangular Hotspot')} autoFit="none" shdw="false" wrap="true" scrollOverflow="true" rtl="false" defHorzAlign="c" horzAlign="c" vertAlign="m" textDir="horz">${tmCtx('txtTmCtx', b, totalMs)}<childLst />${trigLst}<stateLst />${hotBg}${locXml(ctx, b)}<animEffect />${hLink}<text>${emptyDoc}</text><fmtText></fmtText>${propBag()}${DIAL}<textMargin l="10" t="5" r="10" b="5" /><bounds l="0" t="0" r="0" b="0" /><resize fontNm="" fontSz="0" /><margins l="0" t="0" r="0" b="0" /><parLst /><plain></plain><hLinkLst /></clkAreaRect>`;
  }

  // Shapes and buttons. Anything else becomes an outlined box that says what
  // it was, so the slide keeps its layout and nothing vanishes unnoticed.
  let tag = 'rect';
  let geom = '';
  let fill: string | null = null;
  let line: string | null = null;
  let lineW = 0;
  let text: TextOpts | null = null;
  if (b.type === 'shape') {
    const kind = String(p.kind);
    if (kind === 'roundedRectangle') { tag = 'roundRect'; geom = `<prstGeom><roundRect vertexSet="true" radius="${n(Math.min(0.5, (Number(p.cornerRadius) || 12) / Math.max(1, Math.min(b.w, b.h))))}" /></prstGeom>`; }
    else if (kind === 'ellipse') { tag = 'oval'; geom = '<prstGeom><oval vertexSet="false" /></prstGeom>'; }
    else if (kind === 'triangle') { tag = 'triangle'; geom = '<prstGeom><triangle vertexSet="false" v="0.5" /></prstGeom>'; }
    else if (kind !== 'rectangle') warn(ctx, `shape "${kind}" has no confirmed Storyline form and was saved as a rectangle`);
    fill = p.noFill || p.fill === 'transparent' ? null : hex6(p.fill as string, 'FFFFFF');
    lineW = Number(p.borderWidth) || 0;
    line = lineW > 0 && p.borderColor !== 'transparent' ? hex6(p.borderColor as string, '000000') : null;
    if (p.nodes || (p.points && !p.isLine)) warn(ctx, 'a custom (pen) shape was saved as a rectangle');
  } else if (b.type === 'button') {
    tag = 'roundRect';
    geom = '<prstGeom><roundRect vertexSet="true" radius="0.16667" /></prstGeom>';
    fill = hex6((p.fill as string) ?? ctx.project.theme?.accent, '3DDC97');
    text = { html: `<p>${xa(String(p.label ?? 'Button'))}</p>`, size: Number(p.fontSize) || 16, color: hex6(p.textColor as string, '111412'), font: DEFAULT_FONT, align: 'center', valign: 'center', bold: true, inset: { l: 7, t: 3, r: 7, b: 3 } };
  } else if (b.type === 'statement') {
    // A statement card: a light rounded panel with a bold heading and body text.
    tag = 'roundRect';
    geom = '<prstGeom><roundRect vertexSet="true" radius="0.05" /></prstGeom>';
    fill = 'F4F7F5'; line = 'C5CEC7'; lineW = 1;
    const heading = String(p.heading ?? '');
    const body = String(p.body ?? '');
    text = { html: `${heading ? `<p><strong>${xa(heading)}</strong></p>` : ''}${body ? `<p>${xa(body)}</p>` : ''}` || '<p> </p>', size: 16, color: '1C211D', font: DEFAULT_FONT, align: 'left', valign: 'top', bold: false, inset: { l: 16, t: 12, r: 16, b: 12 } };
  } else if (b.type === 'progress') {
    // Storyline has no progress bar object, but it does keep the numbers:
    // the course position as built-in variables, or the author's own variable.
    const v = ctx.project.variables.find((x) => x.id === p.variableId);
    const value = p.source === 'variable' && v ? `%${v.name.replace(/[^A-Za-z0-9_]/g, '_')}%` : 'Slide %Project.SlideNumber% of %Project.TotalSlides%';
    text = { html: `<p>${value}</p>`, size: Math.max(14, Math.min(b.h * 0.5, 22 * scaleOf(ctx))), color: '3D4A42', font: DEFAULT_FONT, align: 'center', valign: 'center', bold: true, inset: { l: 7, t: 3, r: 7, b: 3 } };
  } else if (b.type === 'varDisplay') {
    // A variable readout: Storyline shows a variable's value wherever its
    // name sits between percent signs.
    const ref = String(p.reference ?? '').replace(/[^A-Za-z0-9_.]/g, '_');
    const label = p.label ? `<p><span style="font-size: ${Math.round((Number(p.fontSize) || 32) * 0.4)}px">${xa(String(p.label))}</span></p>` : '';
    if (p.tile) { tag = 'roundRect'; geom = '<prstGeom><roundRect vertexSet="true" radius="0.1" /></prstGeom>'; fill = 'FFFFFF'; line = 'C5CEC7'; lineW = 1; }
    text = { html: `<p>${xa(String(p.prefix ?? ''))}%${ref}%${xa(String(p.suffix ?? ''))}</p>${label}`, size: Math.min(Number(p.fontSize) || 32, Math.max(14, Math.round(b.w / 5))), color: hex6(p.color as string, '0B6B45'), font: DEFAULT_FONT, align: String(p.align ?? 'center'), valign: 'center', bold: true, inset: { l: 7, t: 3, r: 7, b: 3 } };
    if (!ctx.project.variables.some((v) => v.name.replace(/[^A-Za-z0-9_]/g, '_') === ref)) warn(ctx, `a value display points at "${ref}", which is not one of the course's own variables, so Storyline will show the name as text`);
  } else {
    warn(ctx, `"${b.type}" blocks have no Storyline equivalent; an outlined box marks where each one was`);
    line = 'C2410C'; lineW = 1;
    text = { html: `<p>${xa(`${b.name || b.type} (eLearnForge ${b.type} block, not converted)`)}</p>`, size: 14, color: 'C2410C', font: DEFAULT_FONT, align: 'center', valign: 'center', bold: false, inset: { l: 7, t: 3, r: 7, b: 3 } };
  }
  const t = textTail(b, text);
  return `<${tag} ${head(b, g, z, '110855', tag)} autoFit="none" shdw="none" wrap="true" scrollOverflow="none" rtl="false" defHorzAlign="c" horzAlign="${text ? halignAttr(text.align) : 'not'}" vertAlign="${text ? valignAttr(text.valign) : 'not'}" textDir="not">${tmCtx('txtTmCtx', b, totalMs)}<childLst />${trigLst}<stateLst />${paintBg(fill, line, lineW)}${locXml(ctx, b)}${anim}${hLink}${t.text}${propBag()}${geom}${t.tail}</${tag}>`;
}

// ---------- triggers ----------
interface TrigParts { g?: string; submitG?: string; keys?: string; js?: string; open?: string; varChange?: string; event: string; action: string; sub?: string; intent?: string; navState?: string; slide?: string; shape?: string; layer?: string; other?: string; cond?: string; name?: string; group?: string; frameAction?: string; enabled?: boolean; edit?: string; cue?: string }
function trigXml(owner: string, t: TrigParts): string {
  const shape = t.shape ?? 'setStateName="" setstateop="ass" stateInclude="all" statesNot="are" stateName=""';
  const other = t.other ?? 'op="ass" varVal1="" useVar="false" dblVal="0" boolVal="True"';
  // "When a variable changes" names the watched variable next to the target one.
  const otherAttrs = t.varChange ? (other.includes('varG=') ? other.replace(/(varG="[^"]+")/, `$1 varChangeG="${t.varChange}"`) : `varChangeG="${t.varChange}" ${other}`) : other;
  return `<trig g="${t.g ?? guid()}" verG="${guid()}" name="${t.name ?? ''}" type="user" edit="${t.edit ?? 'all'}" group="${t.group ?? 'none'}" copiedG="${owner}"><data enabled="${t.enabled === false ? 'false' : 'true'}" event="${t.event}" action="${t.action}" actSubType="${t.sub ?? 'next'}" NavigationIntent="${t.intent ?? 'Unspecified'}" NavigationState="${t.navState ?? 'None'}"><keyPress keys="${t.keys ?? 'None'}" case="false" /><slide ${t.slide ?? ''}showNav="false" /><scene /><shape ${shape}><stateLst /><dropLst /><intersectLst /><stopIntersectLst /><hoverLst /></shape><clickLst /><sldLayer ${t.layer ?? ''}/><video /><audio /><other open="${t.open ? xa(t.open) : ''}" email="" js="${t.js ? xa(t.js).replace(/\r?\n/g, '&#xA;') : ''}" ${otherAttrs} positiveCompletion="true" time="PT0S" cuePoint="${t.cue ?? '-2147483648'}" useRandom="false" randomMin="0" randomMax="0"${t.open ? '><browserOptions action="new" ctrls="def" wndSz="def"><custWndSz w="800" h="600" /></browserOptions></other>' : ' />'}${t.submitG ? `<interaction submitG="${t.submitG}" />` : '<interaction />'}<SeekTimeline target="${ZERO}" timeSeconds="0" cuePoint="-1" variableReference="false" useRelativeTime="false" relativeTime="NaN" modifyPlaybackState="false" playbackState="Play" /><frame ${t.frameAction ? `actionG="${t.frameAction}" ` : ''}restore="true" /></data>${t.cond ? `<condLst>${t.cond}</condLst>` : '<condLst />'}</trig>`;
}
const NAV_EDIT = 'variablename, subslides, keypresskeys, actions, operators, variablevalue, variableoperators';
const defaultNext = (owner: string) => trigXml(owner, { name: 'Navigation', edit: NAV_EDIT, group: 'next', event: 'OnNextButtonClick', action: 'jumpToSlide', sub: 'next', intent: 'Next', navState: 'Button, Gesture', cue: '0', frameAction: '0ec0db78-2e1d-4919-bde6-6824587f77c4' });
// Storyline writes the Previous trigger's own id as its frame action.
const defaultPrev = (owner: string, g = guid()) => trigXml(owner, { g, name: 'Previous', edit: NAV_EDIT, event: 'OnClick', action: 'jumpToSlide', sub: 'prev', intent: 'Previous', navState: 'Button, Gesture', cue: '0', frameAction: g });

const STATE_OUT: Record<string, string> = { normal: 'Normal', visited: 'Visited', selected: 'Selected', disabled: 'Disabled', hidden: 'Hidden' };

function actionParts(ctx: Ctx, a: Action, sourceBlockId: string | undefined): Partial<TrigParts> | string {
  const self = (id: string) => (id === 'self' ? sourceBlockId ?? '' : id);
  const variable = (id: string): Variable | undefined => ctx.project.variables.find((v) => v.id === id);
  switch (a.type) {
    case 'nextSlide': return { action: 'jumpToSlide', sub: 'next' };
    case 'prevSlide': return { action: 'jumpToSlide', sub: 'prev' };
    case 'goToSlide': return ctx.slideG.has(a.slideId) ? { action: 'jumpToSlide', sub: 'spec', slide: `jumpG="${ctx.slideG.get(a.slideId)}" ` } : 'a jump to a deleted slide';
    case 'showLayer': return ctx.layerG.has(a.layerId) ? { action: 'showSubSlide', sub: 'spec', layer: `showG="${ctx.layerG.get(a.layerId)}" ` } : 'show a deleted layer';
    case 'hideLayer': return ctx.layerG.has(a.layerId) ? { action: 'hideSubSlide', sub: 'spec', layer: `showG="${ctx.layerG.get(a.layerId)}" hideG="${ctx.layerG.get(a.layerId)}" ` } : 'hide a deleted layer';
    case 'openLightbox': return ctx.slideG.has(a.slideId) ? { action: 'LightboxSlide', sub: 'spec', slide: `lightBoxG="${ctx.slideG.get(a.slideId)}" ` } : 'a lightbox of a deleted slide';
    case 'completeCourse': return { action: 'CompleteCourse' };
    case 'setVariable': {
      const v = variable(a.variableId);
      if (!v) return 'set a deleted variable';
      const val = v.type === 'boolean' ? `varVal1="" useVar="false" dblVal="0" boolVal="${a.value ? 'True' : 'False'}"`
        : v.type === 'number' ? `varVal1="" useVar="false" dblVal="${n(Number(a.value) || 0)}" boolVal="True"`
        : `varVal1="${xa(String(a.value ?? ''))}" useVar="false" dblVal="0" boolVal="True"`;
      return { action: 'adjustVar', sub: 'spec', other: `varG="${ctx.varG.get(v.id)}" op="ass" ${val}` };
    }
    case 'adjustVariable': {
      const v = variable(a.variableId);
      if (!v) return 'adjust a deleted variable';
      return { action: 'adjustVar', sub: 'next', other: `varG="${ctx.varG.get(v.id)}" op="add" varVal1="" useVar="false" dblVal="${n(a.delta)}" boolVal="True"` };
    }
    case 'setState': case 'showBlock': case 'hideBlock': {
      const id = self(a.blockId);
      const state = a.type === 'setState' ? STATE_OUT[a.state] : a.type === 'showBlock' ? 'Normal' : 'Hidden';
      return ctx.blockG.has(id) && state ? { action: 'changeShapeState', shape: `setStateG="${ctx.blockG.get(id)}" setStateName="${state}" setstateop="ass" stateInclude="all" statesNot="are" stateName=""` } : 'a state change on a deleted block';
    }
    // Everything below has no Storyline action, so it travels as an Execute
    // JavaScript trigger: working script where one exists, otherwise a comment
    // that says what the trigger did, so the logic is not lost.
    case 'executeJs':
      return { action: 'executeJavaScript', js: `// From eLearnForge. forge.get / forge.set calls need rewriting for Storyline: GetPlayer().GetVar / SetVar.\n${a.code}` };
    case 'openUrl':
      return { action: 'jumpToFileUrl', open: a.url };
    case 'resetVariable': {
      const v = variable(a.variableId);
      return v ? { action: 'executeJavaScript', js: `GetPlayer().SetVar(${JSON.stringify(v.name.replace(/[^A-Za-z0-9_]/g, '_'))}, ${JSON.stringify(v.defaultValue)});` } : 'reset a deleted variable';
    }
    default: {
      warn(ctx, `"${a.type}" has no Storyline action; it was saved as an Execute JavaScript trigger holding a note`);
      return { action: 'executeJavaScript', js: `// eLearnForge action with no Storyline equivalent: ${JSON.stringify(a)}` };
    }
  }
}

const COND_OPS: Record<string, string> = { eq: 'eq', lt: 'lt', gt: 'gt', gte: 'gte' };
function condXml(ctx: Ctx, conds: Condition[], logic: 'and' | 'or'): string | null {
  let out = '';
  for (const c of conds) {
    const v = ctx.project.variables.find((x) => x.id === c.variableId);
    const op = COND_OPS[c.operator ?? 'eq'];
    if (c.blockId || !v || !op) return null;
    const value = c.value ?? c.equals;
    const num = v.type === 'number' ? Number(value) || 0 : 0;
    const boolVal = v.type === 'boolean' && value ? 'True' : '';
    out += `<trigCond ${gv()} lightBox="false" op="${op}" strVal1="${v.type === 'string' ? xa(String(value ?? '')) : ''}" strVal2="" floatVal1="${n(num)}" floatVal2="0" boolVal="${boolVal}" varG="${ctx.varG.get(v.id)}" varG2="${ZERO}" dataType="value" andOr="${logic}"><shapeState shapeG="${ZERO}" op="eq" name="Normal" /></trigCond>`;
  }
  return out;
}

// Triggers grouped by the element that owns them in Storyline: the slide, a
// layer, or a shape.
function sortTriggers(ctx: Ctx, slide: Slide): { slideTrigs: string; layerTrigs: Map<string, string>; blockTrigs: Map<string, string>; customNext: boolean } {
  const slideG = ctx.slideG.get(slide.id)!;
  let slideTrigs = '';
  let customNext = false;
  const layerTrigs = new Map<string, string>();
  const blockTrigs = new Map<string, string>();
  const push = (m: Map<string, string>, k: string, x: string) => m.set(k, (m.get(k) ?? '') + x);

  for (const t of slide.triggers) {
    const cond = condXml(ctx, t.conditions, t.conditionLogic ?? 'and');
    if (cond === null) { warn(ctx, 'a trigger with a condition Storyline cannot express here (object state, or an operator other than =, <, >) was left out'); continue; }
    for (const a of t.actions) {
      const parts = actionParts(ctx, a, t.sourceBlockId);
      if (typeof parts === 'string') { warn(ctx, `a trigger was left out: ${parts} has no confirmed Storyline form`); continue; }
      const base = { ...parts, cond, enabled: t.enabled } as TrigParts;
      const src = t.sourceBlockId && ctx.blockG.get(t.sourceBlockId);
      switch (t.event) {
        case 'onClick': if (src) push(blockTrigs, t.sourceBlockId!, trigXml(src, { ...base, event: 'OnClick' })); break;
        case 'onHover': if (src) push(blockTrigs, t.sourceBlockId!, trigXml(src, { ...base, event: 'OnMouseHover' })); break;
        case 'onKeyPress': {
          const k = t.key ?? '';
          const keys = ({ ArrowRight: 'Right', ArrowLeft: 'Left', ArrowUp: 'Up', ArrowDown: 'Down' } as Record<string, string>)[k] ?? (/^[a-z0-9]$/i.test(k) ? k.toUpperCase() : '');
          if (keys) slideTrigs += trigXml(slideG, { ...base, event: 'OnKeyPress', keys });
          else warn(ctx, `a key-press trigger on "${k}" was left out: only arrow keys, letters and digits have a confirmed form`);
          break;
        }
        case 'onAnimationComplete': if (src) push(blockTrigs, t.sourceBlockId!, trigXml(src, { ...base, event: 'OnAnimationComplete' })); break;
        case 'onBlockEnters': if (src) push(blockTrigs, t.sourceBlockId!, trigXml(src, { ...base, event: 'OnStart' })); break;
        case 'onSlideLoad': case 'onTimelineStart': slideTrigs += trigXml(slideG, { ...base, event: 'OnStart' }); break;
        case 'onTimelineEnd': slideTrigs += trigXml(slideG, { ...base, event: 'OnEnd', cue: '0' }); break;
        case 'onVariableChange': {
          const wg = t.watchVariableId && ctx.varG.get(t.watchVariableId);
          if (wg) slideTrigs += trigXml(slideG, { ...base, event: 'OnVariableValueChange', varChange: wg });
          else warn(ctx, 'a "when any variable changes" trigger was left out: Storyline needs one named variable');
          break;
        }
        case 'onNext': customNext = true; slideTrigs += trigXml(slideG, { ...base, name: 'Navigation', edit: NAV_EDIT, group: 'next', event: 'OnNextButtonClick', intent: 'Next', navState: 'Button, Gesture', cue: '0' }); break;
        case 'onLayerShown': {
          const lg = t.layerId && ctx.layerG.get(t.layerId);
          if (lg) push(layerTrigs, t.layerId!, trigXml(lg, { ...base, event: 'OnStart' }));
          break;
        }
        default: warn(ctx, `a trigger on "${t.event}" was left out: that event has no confirmed Storyline form`);
      }
    }
  }
  return { slideTrigs, layerTrigs, blockTrigs, customNext };
}

// ---------- quiz questions ----------
// A multiple-choice block becomes a Storyline freeform question: a text box
// for the question, one rounded rectangle per choice (with Normal, Hover and
// Selected states), a Submit button, the invisible question object that says
// which choices are right, and Correct / Incorrect feedback layers. Storyline
// allows one question per slide.
const plainDoc = (text: string, size: number, color: string, bold: boolean, align: string) =>
  documentXml([{ runs: [{ text, bold, italic: false, underline: false, strike: false, sup: false, color, size, font: DEFAULT_FONT }], align, list: '' }]);

interface BoxOpts {
  tag: 'roundRect' | 'textBox' | 'rect'; g: string; name: string; z: number; x: number; y: number; w: number; h: number; totalMs: number;
  fill: string | null; line: string | null; lineW: number; text?: { value: string; size: number; color: string; bold: boolean; align: string; pad: number };
  trigs?: string; states?: string; initState?: string; radius?: number;
  grow?: boolean; // the box grows to fit its text
}
function boxShape(ctx: Ctx, o: BoxOpts): string {
  const timing = `<tmProps ${gv()} cur="0" min="5000" visible="true" hideAll="false" /><tmCtxLst version="2"><txtTmCtx ${gv()} start="0" dur="${o.totalMs}" min="250" max="0" hasMax="false" alwysShw="false" untilEnd="true" assetStart="0" name="" /></tmCtxLst>`;
  const t = o.text;
  const text = t ? `<text>${xa(plainDoc(t.value, t.size, t.color, t.bold, t.align))}</text>` : '';
  const tail = t
    ? `${DIAL}<textMargin l="${t.pad}" t="6" r="${t.pad}" b="6" /><bounds l="${t.pad}" t="6" r="${n(Math.max(t.pad + 1, o.w - t.pad))}" b="${n(Math.max(7, o.h - 6))}" /><resize fontNm="" fontSz="0" /><margins l="0" t="0" r="0" b="0" /><parLst /><plain>${xa(t.value)}</plain><hLinkLst />`
    : `${DIAL}<textMargin l="7" t="3" r="7" b="3" /><bounds l="0" t="0" r="0" b="0" /><resize fontNm="" fontSz="0" /><margins l="0" t="0" r="0" b="0" /><parLst /><plain></plain><hLinkLst />`;
  const geom = o.tag === 'roundRect' ? `<prstGeom><roundRect vertexSet="true" radius="${n(o.radius ?? 0.16667)}" /></prstGeom>` : '';
  const bg = o.tag === 'textBox' ? BG_DEFAULT : paintBg(o.fill, o.line, o.lineW);
  return `<${o.tag} g="${o.g}" verG="${guid()}" timeManagerVisibilityLocked="false" typeName="" id="-1" name="${xa(o.name)}" state="110855" zOrder="${o.z}" editCtx="Normal" initState="${o.initState ?? ''}" handCur="true" rot="-1" acc="true" autoFit="${o.grow ? 'resize' : 'none'}" shdw="none" wrap="true" scrollOverflow="none" rtl="false" defHorzAlign="l" horzAlign="${t ? halignAttr(t.align) : 'not'}" vertAlign="${t ? (o.grow ? 't' : 'm') : 'not'}" textDir="not">${timing}<childLst />${o.trigs ? `<trigLst>${o.trigs}</trigLst>` : '<trigLst />'}${o.states ? `<stateLst>${o.states}</stateLst>` : '<stateLst />'}${bg}<sldSz w="${ctx.w}" h="${ctx.h}" /><loc l="${n(o.x)}" t="${n(o.y)}" r="${n(o.x + o.w)}" b="${n(o.y + o.h)}" /><animEffect />${hLink}${text}${propBag()}${geom}${tail}</${o.tag}>`;
}

function stateXml(ctx: Ctx, name: string, inner: BoxOpts): string {
  const innerG = guid();
  return `<state ${gv()} timeManagerVisibilityLocked="false" typeName="" id="0" state="0" showMasterSp="false" name="${name}" role="" resetMode="auto" layoutG="${STATE_LAYOUT_G}" stateG="${ZERO}" showPlay="false" clrScheme="def" isDrawingThemeUpgraded="true" defG="${innerG}"><tmProps ${gv()} cur="0" min="5000" visible="true" hideAll="false" /><sz w="0" h="0" /><bg>${GRAD_NONE.replace(BIG, '3.4028235E+38')}</bg><shapeLst>${boxShape(ctx, { ...inner, g: innerG, x: 0, y: 0, z: 0, states: undefined, trigs: undefined, initState: '' })}</shapeLst><trigLst /><trans /><text></text><shapeSz w="0" h="0" /></state>`;
}

function feedbackLayer(ctx: Ctx, o: { g: string; id: number; label: 'Correct' | 'Incorrect'; message: string; totalMs: number }): string {
  const ok = o.label === 'Correct';
  const k = scaleOf(ctx);
  const px = (v: number) => Math.round(v * k);
  const w = Math.min(ctx.w - px(80), px(640)), h = px(300);
  const x = (ctx.w - w) / 2, y = (ctx.h - h) / 2;
  const btnG = guid();
  const shapes =
    boxShape(ctx, { tag: 'roundRect', g: guid(), name: 'Feedback panel', z: 0, x, y, w, h, totalMs: o.totalMs, fill: ok ? 'E6F6EE' : 'FDECEA', line: ok ? '0E9F66' : 'D6453D', lineW: Math.max(2, px(2)), radius: 0.06 }) +
    boxShape(ctx, { tag: 'textBox', g: guid(), name: 'Feedback title', z: 1, x: x + px(36), y: y + px(30), w: w - px(72), h: px(60), totalMs: o.totalMs, fill: null, line: null, lineW: 0, text: { value: ok ? 'Correct' : 'Not quite', size: px(30), color: ok ? '0B6B45' : 'A3231F', bold: true, align: 'left', pad: 0 } }) +
    boxShape(ctx, { tag: 'textBox', g: guid(), name: 'Feedback text', z: 2, x: x + px(36), y: y + px(98), w: w - px(72), h: px(104), totalMs: o.totalMs, fill: null, line: null, lineW: 0, text: { value: o.message, size: px(20), color: '1C211D', bold: false, align: 'left', pad: 0 } }) +
    boxShape(ctx, { tag: 'roundRect', g: btnG, name: 'Continue', z: 3, x: x + px(36), y: y + h - px(88), w: px(190), h: px(56), totalMs: o.totalMs, fill: ok ? '0B6B45' : 'A3231F', line: null, lineW: 0, radius: 0.5, text: { value: 'Continue', size: px(19), color: 'FFFFFF', bold: true, align: 'center', pad: px(8) }, trigs: trigXml(btnG, { event: 'OnClick', action: 'jumpToSlide', sub: 'next' }) });
  return `<feedBackLayer g="${o.g}" verG="${guid()}" timeManagerVisibilityLocked="false" typeName="" id="${o.id}" state="0" showMasterSp="false" name="" role="" resetMode="auto" layoutG="${LAYER_LAYOUT_G}" stateG="${ZERO}" showPlay="false" clrScheme="def" isDrawingThemeUpgraded="true" modal="false" pause="false" stop="true" hideEnd="false" top="true" seek="n" presentAs="Layer" labeledBy="${ZERO}" describedBy="${ZERO}" seekInheritable="n" choiceG="${ZERO}" defaultName="${o.label}"><tmProps ${gv()} cur="0" min="${o.totalMs}" visible="false" hideAll="false"><markers nextId="0" /></tmProps><tmCtxLst version="1"><tmCtx ${gv()} start="0" dur="0" min="250" max="0" hasMax="false" alwysShw="false" untilEnd="false" assetStart="0" name="" /></tmCtxLst><sz w="0" h="0" /><bg>${SLIDE_BG}</bg><shapeLst>${shapes}</shapeLst><trigLst /><localizedName /><trans /><thumbProv g="${guid()}" sz="30" /></feedBackLayer>`;
}

// The course accent, darkened until white text reads on it.
function accentForText(ctx: Ctx): string {
  const base = hex6(ctx.project.theme?.accent, '0B6B45');
  let c = [0, 2, 4].map((i) => parseInt(base.slice(i, i + 2), 16));
  const lum = () => c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (let i = 0; i < 30 && 1.05 / (lum() + 0.05) < 4.5; i++) c = c.map((v) => v * 0.92);
  return c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Slides come in different pixel sizes (1280 wide here, 1920 in Storyline's
// default). Sizes below are for a 1280-wide slide and scale with it, so text
// and outlines keep their weight.
const scaleOf = (ctx: Ctx) => Math.max(0.75, ctx.w / 1280);

const QUESTION_TYPES = new Set(['multipleChoice', 'dragDrop', 'matching', 'sequence']);

function questionXml(ctx: Ctx, b: Block, zStart: number, totalMs: number, firstLayerId: number): { shapes: string; count: number; layers: string } {
  const p = b.props as unknown as Record<string, unknown>;
  const k = scaleOf(ctx);
  const px = (v: number) => Math.round(v * k);
  const accent = accentForText(ctx);
  const pad = px(28);
  const gap = px(14);
  const innerW = b.w - pad * 2;
  const question = String(p.question ?? '');
  const qSize = px(24);
  // Room for the question at roughly 1.35 line height, two lines at least.
  const qLines = Math.max(1, Math.ceil((question.length * qSize * 0.55) / Math.max(1, innerW)));
  const qH = Math.max(px(64), Math.round(qLines * qSize * 1.4) + px(12));
  const submitH = px(56);
  const top = b.y + pad + qH + gap;
  const bodyH = Math.max(px(120), b.h - pad * 2 - qH - submitH - gap * 2);
  let z = zStart;
  let shapes = boxShape(ctx, { tag: 'textBox', g: guid(), name: 'Question', z: z++, x: b.x + pad, y: b.y + pad, w: innerW, h: qH, totalMs, fill: null, line: null, lineW: 0, grow: true, text: { value: question, size: qSize, color: '1C211D', bold: true, align: 'left', pad: 0 } });
  const choiceXml: string[] = [];
  const order: string[] = [];
  const line = Math.max(2, px(2));
  const choice = (drag: string, target: string, correct: boolean) =>
    `<intrFreeChoice ${gv()} shpG="${drag}" matchShpG="${target}" shpMainGrpG="${ZERO}" matchShpMainGrpG="${ZERO}" compType="none" numA="0" numB="0"><scoringData correct="${correct}" pts="0" feedBkG="${ZERO}" showFeedBk="false" shuffle="true" /><text></text><localizedText /></intrFreeChoice>`;
  let template = PICK_ONE_INTR;

  if (b.type === 'multipleChoice') {
    const choices = (p.choices ?? []) as { id: string; text: string }[];
    const right = (p.correctChoiceIds ?? []) as string[];
    template = p.allowMultiple ? PICK_MANY_INTR : PICK_ONE_INTR;
    const count = Math.max(1, choices.length);
    const rowH = Math.max(px(60), Math.min(px(84), Math.floor((bodyH - gap * (count - 1)) / count)));
    choices.forEach((c, i) => {
      const cg = guid();
      const letter = String.fromCharCode(65 + (i % 26));
      const base = { tag: 'roundRect' as const, g: cg, name: `Choice ${letter}`, z: 0, x: b.x + pad, y: top + i * (rowH + gap), w: innerW, h: rowH, totalMs, radius: 0.22, lineW: line };
      const label = { value: `${letter}.   ${c.text}`, size: px(20), bold: false, align: 'left', pad: px(24) };
      const states =
        stateXml(ctx, 'Normal', { ...base, fill: 'FFFFFF', line: 'C3CCC5', text: { ...label, color: '1C211D' } }) +
        stateXml(ctx, 'Hover', { ...base, fill: 'F1F8F4', line: accent, text: { ...label, color: '1C211D' } }) +
        stateXml(ctx, 'Selected', { ...base, fill: accent, line: accent, text: { ...label, color: 'FFFFFF', bold: true } });
      shapes += boxShape(ctx, { ...base, z: z++, fill: 'FFFFFF', line: 'C3CCC5', states, initState: 'Normal' });
      choiceXml.push(choice(cg, ZERO, right.includes(c.id)));
    });
  } else {
    // Drag and drop, matching and sequence all become a freeform drag-and-drop
    // question: drag items on the left, drop targets on the right.
    template = DRAG_DROP_INTR;
    let drags: { text: string; target: number }[] = [];
    let targets: string[] = [];
    if (b.type === 'dragDrop') {
      const ts = (p.targets ?? []) as { id: string; label: string }[];
      targets = ts.map((t) => t.label);
      drags = ((p.items ?? []) as { text: string; targetId: string }[]).map((it) => ({ text: it.text, target: ts.findIndex((t) => t.id === it.targetId) }));
    } else if (b.type === 'matching') {
      const pairs = (p.pairs ?? []) as { left: string; right: string }[];
      targets = pairs.map((x) => x.left);
      drags = pairs.map((x, i) => ({ text: x.right, target: i }));
    } else {
      const items = (p.items ?? []) as { text: string }[];
      targets = items.map((_, i) => `${i + 1}`);
      drags = items.map((x, i) => ({ text: x.text, target: i }));
    }
    // Shown in a different order from the answer, so the layout does not give it away.
    const shown = drags.map((d, i) => ({ ...d, i })).sort((a, c) => ((a.i * 7 + 3) % drags.length) - ((c.i * 7 + 3) % drags.length));
    const colW = Math.floor((innerW - gap * 2) / 2);
    const dragH = Math.max(px(52), Math.min(px(72), Math.floor((bodyH - gap * (Math.max(1, shown.length) - 1)) / Math.max(1, shown.length))));
    const tCount = Math.max(1, targets.length);
    const targetH = Math.max(px(72), Math.floor((bodyH - gap * (tCount - 1)) / tCount));
    const targetG = targets.map(() => guid());
    targets.forEach((label, i) => {
      shapes += boxShape(ctx, { tag: 'roundRect', g: targetG[i], name: `Drop target ${i + 1}`, z: z++, x: b.x + pad + colW + gap * 2, y: top + i * (targetH + gap), w: colW, h: targetH, totalMs, fill: 'F4F7F5', line: 'A9B5AC', lineW: line, radius: 0.12, text: { value: label, size: px(18), color: '3D4A42', bold: true, align: 'center', pad: px(12) } });
    });
    shown.forEach((d, row) => {
      const dg = guid();
      shapes += boxShape(ctx, { tag: 'roundRect', g: dg, name: `Drag item ${row + 1}`, z: z++, x: b.x + pad, y: top + row * (dragH + gap), w: colW, h: dragH, totalMs, fill: 'FFFFFF', line: accent, lineW: line, radius: 0.25, text: { value: d.text, size: px(18), color: '1C211D', bold: false, align: 'center', pad: px(14) } });
      choiceXml.push(choice(dg, targetG[d.target] ?? ZERO, false));
      order.push(`<g>${dg}</g>`);
    });
  }

  const intrG = guid(), corG = guid(), incG = guid(), submitG = guid();
  shapes += boxShape(ctx, { tag: 'roundRect', g: submitG, name: 'Submit', z: z++, x: b.x + pad, y: b.y + b.h - pad - submitH, w: px(190), h: submitH, totalMs, fill: accent, line: null, lineW: 0, radius: 0.5, text: { value: 'Submit', size: px(20), color: 'FFFFFF', bold: true, align: 'center', pad: px(8) }, trigs: trigXml(submitG, { name: 'SubmitInteraction', group: 'next', event: 'OnClick', action: 'submitInteraction', submitG: intrG, cue: '0' }) });
  // Fresh ids for everything inside the copied question object, then the ones it is wired by.
  shapes += template
    .replace(/ (g|verG)="[0-9a-f-]{36}"/g, (_m, key) => ` ${key}="${guid()}"`)
    .replace('@@G@@', intrG).replace('@@ANS@@', guid()).replace('@@INC@@', incG).replace('@@COR@@', corG).replace('@@ZERO@@', ZERO).replace('@@INTRG@@', guid())
    .replace(/@@W@@/g, String(ctx.w)).replace(/@@H@@/g, String(ctx.h)).replace('@@ATTEMPTS@@', 'one')
    .replace(/zOrder="\d+"/, `zOrder="${z++}"`)
    .replace('@@CHOICES@@', choiceXml.join('')).replace('@@ORDER@@', order.join(''));
  const layers =
    feedbackLayer(ctx, { g: corG, id: firstLayerId, label: 'Correct', message: String(p.feedbackCorrect || 'That is right.'), totalMs }) +
    feedbackLayer(ctx, { g: incG, id: firstLayerId + 1, label: 'Incorrect', message: String(p.feedbackIncorrect || 'That is not right.'), totalMs });
  return { shapes, count: z - zStart, layers };
}

// Tabs and accordions: a button per panel and a layer per panel. Showing one
// layer hides the others, which is how Storyline builds tabs.
function tabsXml(ctx: Ctx, b: Block, zStart: number, totalMs: number, firstLayerId: number): { shapes: string; count: number; layers: string; onStart: string } {
  const p = b.props as unknown as { panels: { id: string; label: string; html: string }[]; accent?: string; fontSize?: number };
  const k = scaleOf(ctx);
  const px = (v: number) => Math.round(v * k);
  const accent = accentForText(ctx);
  const panels = p.panels ?? [];
  const tabH = px(52);
  const gap = px(8);
  const tabW = Math.floor((b.w - gap * Math.max(0, panels.length - 1)) / Math.max(1, panels.length));
  let z = zStart;
  let shapes = '';
  let layers = '';
  let first = '';
  panels.forEach((panel, i) => {
    const tg = guid(), lg = guid();
    if (i === 0) first = lg;
    shapes += boxShape(ctx, { tag: 'roundRect', g: tg, name: `Tab: ${panel.label}`, z: z++, x: b.x + i * (tabW + gap), y: b.y, w: tabW, h: tabH, totalMs, fill: accent, line: null, lineW: 0, radius: 0.25, text: { value: panel.label, size: px(17), color: 'FFFFFF', bold: true, align: 'center', pad: px(8) }, trigs: trigXml(tg, { event: 'OnClick', action: 'showSubSlide', sub: 'spec', layer: `showG="${lg}" ` }) });
    const body: Block = { id: `tabbody-${i}`, type: 'text', x: b.x, y: b.y + tabH + gap, w: b.w, h: Math.max(px(60), b.h - tabH - gap), props: {} } as Block;
    const paras = htmlToParas(panel.html || '<p> </p>', { color: '1C211D', size: (p.fontSize ?? 16) * k, font: DEFAULT_FONT, align: 'left', bold: false });
    const text = `<text>${xa(documentXml(paras.length ? paras : [{ runs: [], align: 'left', list: '' }]))}</text>`;
    const inset = px(18);
    const panelShape = `<roundRect g="${guid()}" verG="${guid()}" timeManagerVisibilityLocked="false" typeName="" id="-1" name="${xa(panel.label)} panel" state="110855" zOrder="0" editCtx="Normal" initState="" handCur="true" rot="-1" acc="true" autoFit="none" shdw="none" wrap="true" scrollOverflow="none" rtl="false" defHorzAlign="l" horzAlign="l" vertAlign="t" textDir="not"><tmProps ${gv()} cur="0" min="5000" visible="true" hideAll="false" /><tmCtxLst version="2"><txtTmCtx ${gv()} start="0" dur="${totalMs}" min="250" max="0" hasMax="false" alwysShw="false" untilEnd="true" assetStart="0" name="" /></tmCtxLst><childLst /><trigLst /><stateLst />${paintBg('FFFFFF', 'C3CCC5', Math.max(1, px(1.5)))}${locXml(ctx, body)}<animEffect />${hLink}${text}${propBag()}<prstGeom><roundRect vertexSet="true" radius="0.04" /></prstGeom>${DIAL}<textMargin l="${inset}" t="${inset}" r="${inset}" b="${inset}" /><bounds l="${inset}" t="${inset}" r="${n(body.w - inset)}" b="${n(body.h - inset)}" /><resize fontNm="" fontSz="0" /><margins l="0" t="0" r="0" b="0" /><parLst /><plain>${xa(plainOf(paras))}</plain><hLinkLst /></roundRect>`;
    layers += layerXml(ctx, { g: lg, id: firstLayerId + i, name: panel.label || `Panel ${i + 1}`, shapes: `<shapeLst>${panelShape}</shapeLst>`, trigs: '', modal: false, pause: false, ms: totalMs });
  });
  const slideG = '';
  void slideG;
  return { shapes, count: z - zStart, layers, onStart: first };
}

function layerXml(ctx: Ctx, o: { g: string; id: number; name: string; shapes: string; trigs: string; modal: boolean; pause: boolean; ms: number }): string {
  void ctx;
  return `<sldLayer g="${o.g}" verG="${guid()}" timeManagerVisibilityLocked="false" typeName="" id="${o.id}" state="0" showMasterSp="false" name="${xa(o.name)}" role="" resetMode="auto" layoutG="${LAYER_LAYOUT_G}" stateG="${ZERO}" showPlay="false" clrScheme="def" isDrawingThemeUpgraded="true" modal="${o.modal ? 'true' : 'false'}" pause="${o.pause ? 'true' : 'false'}" stop="true" hideEnd="false" top="true" seek="auto" presentAs="Layer" labeledBy="${ZERO}" describedBy="${ZERO}"><tmProps ${gv()} cur="0" min="${o.ms}" visible="false" hideAll="false"><markers nextId="0" /></tmProps><tmCtxLst version="1"><tmCtx ${gv()} start="0" dur="0" min="250" max="0" hasMax="false" alwysShw="false" untilEnd="false" assetStart="0" name="" /></tmCtxLst><sz w="0" h="0" /><bg>${SLIDE_BG}</bg>${o.shapes}${o.trigs ? `<trigLst>${o.trigs}</trigLst>` : '<trigLst />'}<localizedName /><trans /><thumbProv g="${guid()}" sz="30" /></sldLayer>`;
}

// ---------- slides ----------
function flatBlocks(blocks: Block[]): Block[] {
  // Groups are written as their children, moved to slide coordinates.
  return blocks.flatMap((b) => b.type === 'group'
    ? flatBlocks(((b.props as { blocks?: Block[] }).blocks ?? []).map((c) => ({ ...c, x: b.x + c.x, y: b.y + c.y, timing: c.timing ?? b.timing })))
    : [b]);
}

function noteXml(notes: string | undefined): string {
  if (!notes?.trim()) return '<note></note>';
  const blocks = notes.split(/\r?\n/).map((line) => `<Block><Span Text="${xa(line)}" /></Block>`).join('');
  return `<note>${xa(`<Document xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><Content>${blocks}</Content></Document>`)}</note>`;
}

async function shapeList(ctx: Ctx, layer: Layer, totalMs: number, blockTrigs: Map<string, string>, asQuestion?: { firstLayerId: number }): Promise<string> {
  let out = '';
  const blocks = flatBlocks(layer.blocks).filter((b) => !(b.type === 'audio'));
  let z = 0;
  for (const b of blocks) {
    if (QUESTION_TYPES.has(b.type) && asQuestion && !ctx.question) {
      const q = questionXml(ctx, b, z, totalMs, asQuestion.firstLayerId + ctx.addedLayers);
      out += q.shapes; z += q.count;
      ctx.question = { layers: q.layers };
      ctx.addedLayers += 2;
      continue;
    }
    if (QUESTION_TYPES.has(b.type) && asQuestion) warn(ctx, 'Storyline allows one question per slide; a second quiz block on a slide was left as an outlined box');
    if (b.type === 'tabs' && asQuestion) {
      const t = tabsXml(ctx, b, z, totalMs, asQuestion.firstLayerId + ctx.addedLayers);
      out += t.shapes; z += t.count;
      ctx.extraLayers += t.layers;
      ctx.addedLayers += ((b.props as unknown as { panels?: unknown[] }).panels ?? []).length;
      if (t.onStart) ctx.showOnStart.push(t.onStart);
      continue;
    }
    out += await shapeXml(ctx, b, z++, totalMs, blockTrigs.get(b.id) ?? '');
  }
  if (flatBlocks(layer.blocks).some((b) => b.type === 'audio')) warn(ctx, 'audio was left out: adding narration needs Storyline itself (Insert > Audio)');
  return out ? `<shapeLst>${out}</shapeLst>` : '<shapeLst />';
}

async function slideXml(ctx: Ctx, slide: Slide, layoutG: string): Promise<string> {
  const g = ctx.slideG.get(slide.id)!;
  const totalMs = Math.max(5000, Math.round((slide.timeline?.duration ?? 5) * 1000));
  const { slideTrigs, layerTrigs, blockTrigs, customNext } = sortTriggers(ctx, slide);
  ctx.question = null; ctx.extraLayers = ''; ctx.addedLayers = 0; ctx.showOnStart = [];
  const base = await shapeList(ctx, slide.layers[0], totalMs, blockTrigs, { firstLayerId: slide.layers.length });
  const question = ctx.question as { layers: string } | null;
  let layers = '';
  for (const [i, layer] of slide.layers.slice(1).entries()) {
    const lg = ctx.layerG.get(layer.id)!;
    const lMs = Math.max(5000, Math.round((layer.timeline?.duration ?? 5) * 1000));
    const shapes = await shapeList(ctx, layer, lMs, blockTrigs);
    const lt = layerTrigs.get(layer.id);
    layers += `<sldLayer g="${lg}" verG="${guid()}" timeManagerVisibilityLocked="false" typeName="" id="${i + 1}" state="0" showMasterSp="false" name="${xa(layer.name)}" role="" resetMode="auto" layoutG="${LAYER_LAYOUT_G}" stateG="${ZERO}" showPlay="false" clrScheme="def" isDrawingThemeUpgraded="true" modal="${layer.modal ? 'true' : 'false'}" pause="${layer.pauseBase ? 'true' : 'false'}" stop="true" hideEnd="false" top="true" seek="auto" presentAs="Layer" labeledBy="${ZERO}" describedBy="${ZERO}"><tmProps ${gv()} cur="0" min="${lMs}" visible="false" hideAll="false"><markers nextId="0" /></tmProps><tmCtxLst version="1"><tmCtx ${gv()} start="0" dur="0" min="250" max="0" hasMax="false" alwysShw="false" untilEnd="false" assetStart="0" name="" /></tmCtxLst><sz w="0" h="0" /><bg>${SLIDE_BG}</bg>${shapes}${lt ? `<trigLst>${lt}</trigLst>` : '<trigLst />'}<localizedName /><trans /><thumbProv g="${guid()}" sz="30" /></sldLayer>`;
  }
  const bg = slide.background?.type === 'color' && slide.background.color && hex6(slide.background.color, 'FFFFFF') !== 'FFFFFF'
    ? `<solidFill><clr><srgbClr val="${hex6(slide.background.color, 'FFFFFF')}" /></clr></solidFill>${SLIDE_BG}`
    : SLIDE_BG;
  if (slide.background && slide.background.type !== 'color') warn(ctx, 'gradient and picture slide backgrounds were left out');
  const nav = `${customNext ? '' : defaultNext(g)}${defaultPrev(g)}`;
  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?><sld g="${g}" verG="${guid()}" timeManagerVisibilityLocked="true" typeName="" id="0" state="0" showMasterSp="false" name="${xa(slide.name)}" role="" resetMode="auto" layoutG="${question ? QUESTION_LAYOUT_G : layoutG}" stateG="${ZERO}" showPlay="false" clrScheme="def" isDrawingThemeUpgraded="true" assetG="${ZERO}" backVis="trans" layoutType="${question ? 'Quiz Questions' : 'Content'}" hideToc="${slide.lightbox ? 'true' : 'false'}" advMode="${slide.timeline?.autoAdvance ? 'auto' : 'user'}" linkType="none" showInReview="true" includeInSlideCounts="true" zoomTransDur="1000" useNextTrans="true"><tmProps ${gv()} cur="0" min="${totalMs}" visible="true" hideAll="false"><markers nextId="0" /></tmProps><tmCtxLst version="1"><tmCtx ${gv()} start="0" dur="0" min="250" max="0" hasMax="false" alwysShw="false" untilEnd="false" assetStart="0" name="" /></tmCtxLst><sz w="0" h="0" /><bg>${bg}</bg>${base}<trigLst>${nav}${slideTrigs}${ctx.showOnStart.map((lg) => trigXml(g, { event: 'OnStart', action: 'showSubSlide', sub: 'spec', layer: `showG="${lg}" ` })).join('')}</trigLst><localizedName /><trans />${noteXml(slide.notes)}<navData prev="${slide.nav?.back === 'hide' ? 'false' : 'true'}" prevGesture="true" next="${slide.nav?.next === 'hide' ? 'false' : 'true'}" nextGesture="true" submit="false" default="true" menu="true" res="true" glos="false" notes="false" seek="false" replay="false" play="true" search="false" ltBxClse="true" />${layers || question || ctx.extraLayers ? `<sldLayerLst nextIdx="0">${layers}${ctx.extraLayers}${question?.layers ?? ''}</sldLayerLst>` : ''}<thumb g="${guid()}" sz="300" /><localizedNote /><panTime ${gv()} timeManagerVisibilityLocked="false" typeName="" hide="false" lock="false"><tmProps ${gv()} cur="0" min="5000" visible="true" hideAll="false" /><tmCtxLst version="0" /></panTime><panRect g="${guid()}"><rect l="0" t="0" r="0" b="0" /></panRect></sld>`;
}

const BOM = '\uFEFF';
const relsXml = (items: { type: string; target: string; id: string }[]) =>
  `${BOM}<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map((r) => `<Relationship Type="${r.type}" Target="${r.target}" Id="${r.id}" />`).join('')}</Relationships>`;

export async function exportStory(project: Project): Promise<StoryExportResult> {
  const zip = await JSZip.loadAsync(STORY_SHELL_BASE64, { base64: true });
  // No folder entries: a .story is an OPC package, and Storyline's reader
  // rejects a zip that lists directories as entries.
  const put = (path: string, data: string | Uint8Array) => zip.file(path, data, { createFolders: false });
  const read = async (p: string) => (await zip.file(p)!.async('string')).replace(/^\uFEFF/, '');
  const first = project.slides[0];
  const ctx: Ctx = {
    project, w: first?.width ?? 1280, h: first?.height ?? 720, warnings: new Map(),
    slideG: new Map(), layerG: new Map(), blockG: new Map(), varG: new Map(), media: new Map(), slideMedia: new Set(), question: null, extraLayers: '', addedLayers: 0, showOnStart: []
  };
  for (const s of project.slides) {
    ctx.slideG.set(s.id, guid());
    for (const l of s.layers) {
      ctx.layerG.set(l.id, guid());
      for (const b of flatBlocks(l.blocks)) ctx.blockG.set(b.id, guid());
    }
  }
  project.variables.forEach((v) => ctx.varG.set(v.id, guid()));
  if (project.slides.some((s) => s.width !== ctx.w || s.height !== ctx.h)) warn(ctx, 'slides of different sizes were all saved at the size of the first slide');
  if (project.banks?.length) warn(ctx, 'question banks were left out');

  // The shell's one slide: its layout, relationship and files go; ours come in.
  const oldSlide = await read('story/slides/slide.xml');
  const layoutG = /layoutG="([^"]+)"/.exec(oldSlide)?.[1] ?? ZERO;
  const oldG = /<sld g="([^"]+)"/.exec(oldSlide)?.[1] ?? '';
  zip.remove('story/slides/slide.xml');
  zip.remove('story/slides/_rels/slide.xml.rels');

  const shellSlideRel = /<Relationship Type="slide" Target="[^"]+" Id="([^"]+)"/.exec(await read('story/_rels/story.xml.rels'))?.[1] ?? '';
  const slideRels: { type: string; target: string; id: string }[] = [];
  const slideIds: string[] = [];
  let overrides = '';
  for (const [i, slide] of project.slides.entries()) {
    const name = `slide${i === 0 ? '' : (i + 1).toString(16)}.xml`;
    ctx.slideMedia = new Set();
    put(`story/slides/${name}`, BOM + await slideXml(ctx, slide, layoutG));
    if (ctx.slideMedia.size) {
      put(`story/slides/_rels/${name}.rels`, relsXml([...ctx.slideMedia].map((f) => ({ type: 'media', target: `/story/media/${f}`, id: `R${guid().replace(/-/g, '').slice(0, 16)}` }))));
    }
    const id = partId(ctx.slideG.get(slide.id)!);
    slideIds.push(id);
    slideRels.push({ type: 'slide', target: `/story/slides/${name}`, id });
    overrides += `<Override PartName="/story/slides/${name}" ContentType="application/slide+xml" />`;
  }
  for (const m of ctx.media.values()) put(`story/media/${m.file}`, m.bytes);

  // story.xml: variables, media list, slide order, menu entries, slide size.
  let story = await read('story/story.xml');
  const vars = project.variables.map((v) => {
    const dt = v.type === 'boolean' ? 'bool' : v.type === 'number' ? 'num' : 'text';
    const val = v.type === 'boolean' ? (v.defaultValue ? 'True' : 'False') : String(v.defaultValue ?? '');
    return `<var g="${ctx.varG.get(v.id)}" verG="${guid()}" name="${xa(v.name.replace(/[^A-Za-z0-9_]/g, '_'))}" dataType="${dt}" val="${xa(val)}" type="user" propPath="" isRandom="false" randomMin="0" randomMax="0" defaultEmptyIfZero="false" />`;
  }).join('');
  story = story.replace('</varLst>', `${vars}</varLst>`);
  const now = new Date().toISOString().replace('Z', '0000+00:00');
  const mediaXml = [...ctx.media.values()].map((m) =>
    `<media g="${m.g}" verG="${guid()}" type="Png" displayName="${xa(m.name)}" origFile="C:\\eLearnForge\\${xa(m.name)}" source="C:\\eLearnForge\\${xa(m.name)}" useCnt="0" bytes="${m.bytes.length}" modDT="${now}" addDT="${now}"><langAltText /><md5Checksum><stream>${m.hash}</stream><source>${m.hash}</source></md5Checksum></media>`).join('');
  story = story.replace('<mediaLst><mediaLst /></mediaLst>', mediaXml ? `<mediaLst><mediaLst>${mediaXml}</mediaLst></mediaLst>` : '<mediaLst><mediaLst /></mediaLst>');
  // Storyline lists every asset twice: in story.xml and in the theme.
  if (mediaXml) {
    const theme = await read('story/theme/theme.xml');
    put('story/theme/theme.xml', BOM + theme.replace('<assetLst><mediaLst /></assetLst>', `<assetLst><mediaLst>${mediaXml}</mediaLst></assetLst>`));
  }
  story = story.replace(/<sldIdLst>.*?<\/sldIdLst>/, `<sldIdLst>${slideIds.map((id) => `<sldId>${id}</sldId>`).join('')}</sldIdLst>`);
  const tocEntries = project.slides.map((s) => `<tocSlideEntry g="${guid()}" verG="${guid()}" refG="${ctx.slideG.get(s.id)}" corG="${guid()}" expanded="true"><entryLst /><localizedName /></tocSlideEntry>`).join('');
  story = story.replace(/(<tocSceneEntry [^>]*>)<entryLst>.*?<\/entryLst>(<localizedName \/><\/tocSceneEntry>)/, `$1<entryLst>${tocEntries}</entryLst>$2`);
  story = story.replace(/<prop id="15"><sz w="\d+" h="\d+" \/><\/prop>/, `<prop id="15"><sz w="${ctx.w}" h="${ctx.h}" /></prop>`);
  put('story/story.xml', BOM + story);

  // Relationships and content types.
  const storyRels = await read('story/_rels/story.xml.rels');
  const kept = Array.from(storyRels.matchAll(/<Relationship Type="([^"]+)" Target="([^"]+)" Id="([^"]+)" \/>/g))
    .filter((m) => m[1] !== 'slide').map((m) => ({ type: m[1], target: m[2], id: m[3] }));
  put('story/_rels/story.xml.rels', relsXml([...slideRels, ...kept]));
  let types = await read('[Content_Types].xml');
  types = types.replace('<Override PartName="/story/slides/slide.xml" ContentType="application/slide+xml" />', overrides);
  if (ctx.media.size && !types.includes('Extension="png"')) {
    types = types.replace('<Default Extension="jpg" ContentType="image/jpeg" />', '<Default Extension="jpg" ContentType="image/jpeg" /><Default Extension="png" ContentType="image/png" />');
  }
  put('[Content_Types].xml', BOM + types);

  // The summary lists scenes and slides for Storyline's Open dialog.
  let summary = await read('docProps/summary.xml');
  const thumb = /thumbnail="([^"]*)"/.exec(summary)?.[1] ?? '';
  const sumSlides = project.slides.map((s) => `<slide name="${xa(s.name)}" g="${ctx.slideG.get(s.id)}" verG="${guid()}" note="" thumbnail="${thumb}" />`).join('');
  summary = summary.replace(/<slides>.*?<\/slides>/, `<slides>${sumSlides}</slides>`).replace(/slidecount="\d+"/, `slidecount="${project.slides.length}"`);
  // The start path names the first slide by its part id.
  if (project.slides[0] && shellSlideRel) summary = summary.replace(`.${shellSlideRel.slice(1)}"`, `.${partId(ctx.slideG.get(project.slides[0].id)!).slice(1)}"`);
  void oldG;
  put('docProps/summary.xml', BOM + summary);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/octet-stream' });
  return { blob, warnings: [...ctx.warnings].map(([m, c]) => (c > 1 ? `${m} (${c} times)` : m)) };
}
