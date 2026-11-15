import JSZip from 'jszip';
import type { Action, AnimSpec, Block, Condition, Layer, Project, Slide, Trigger, Variable } from '../schema/types';
import { STORY_SHELL_BASE64 } from './storyShell';
import { md5 } from './md5';

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
    case 'wipe': case 'wipeUp': fx = `<wipe ${common} wd="${side(a.direction, 'l')}" />`; break;
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
    m = { g: guid(), file: `${shortId(11, 'R')}.png`, bytes, hash, name: `${name.replace(/[\\/:*?"<>|]/g, '_') || 'Picture'}.png` };
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
      html: String(p.html ?? ''), size: Number(p.fontSize) || 16, color: hex6(p.color as string, '000000'), font: String(p.fontFamily || 'Open Sans'),
      align: String(p.align ?? 'left'), valign: String(p.valign ?? 'top'), bold: Boolean(p.bold) || Number(p.fontWeight) >= 600,
      inset: { l: inset.left ?? 0, t: inset.top ?? 0, r: inset.right ?? 0, b: inset.bottom ?? 0 }
    });
    return `<textBox ${head(b, g, z, '110855', 'Text')} autoFit="none" shdw="none" wrap="true" scrollOverflow="none" rtl="false" defHorzAlign="l" horzAlign="${halignAttr(p.align as string)}" vertAlign="${valignAttr(p.valign as string)}" textDir="not">${tmCtx('txtTmCtx', b, totalMs)}<childLst />${trigLst}<stateLst />${BG_DEFAULT}${locXml(ctx, b)}${anim}${hLink}${t.text}${propBag()}${t.tail}</textBox>`;
  }

  if (b.type === 'image') {
    const assetG = await mediaFor(ctx, String(p.src ?? ''), b.name || 'Picture');
    if (assetG) {
      const alt = p.alt ? `<alt>${xa(String(p.alt))}</alt>` : '';
      return `<pic ${head(b, g, z, '110663', 'Picture')} assetG="${assetG}" imgSet="true" blend="srcCpy" useFileName="false" freeForm="false">${tmCtx('tmCtx', b, totalMs)}<childLst />${trigLst}<stateLst />${BG_DEFAULT}${locXml(ctx, b)}${anim}${hLink}${propBag()}${alt}${DIAL}<picFormat><offset /><tile /><sourceRect l="0" t="0" r="0" b="0" /><pic><brightness /><contrast /><recolor><clr /></recolor><blend><clr /></blend></pic></picFormat></pic>`;
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
    text = { html: `<p>${xa(String(p.label ?? 'Button'))}</p>`, size: Number(p.fontSize) || 16, color: hex6(p.textColor as string, '111412'), font: 'Open Sans', align: 'center', valign: 'center', bold: true, inset: { l: 7, t: 3, r: 7, b: 3 } };
  } else {
    warn(ctx, `"${b.type}" blocks have no Storyline equivalent; an outlined box marks where each one was`);
    line = 'C2410C'; lineW = 1;
    text = { html: `<p>${xa(`${b.name || b.type} (eLearnForge ${b.type} block, not converted)`)}</p>`, size: 14, color: 'C2410C', font: 'Open Sans', align: 'center', valign: 'center', bold: false, inset: { l: 7, t: 3, r: 7, b: 3 } };
  }
  const t = textTail(b, text);
  return `<${tag} ${head(b, g, z, '110855', tag)} autoFit="none" shdw="none" wrap="true" scrollOverflow="none" rtl="false" defHorzAlign="c" horzAlign="${text ? 'c' : 'not'}" vertAlign="${text ? 'm' : 'not'}" textDir="not">${tmCtx('txtTmCtx', b, totalMs)}<childLst />${trigLst}<stateLst />${paintBg(fill, line, lineW)}${locXml(ctx, b)}${anim}${hLink}${t.text}${propBag()}${geom}${t.tail}</${tag}>`;
}

// ---------- triggers ----------
interface TrigParts { g?: string; event: string; action: string; sub?: string; intent?: string; navState?: string; slide?: string; shape?: string; layer?: string; other?: string; cond?: string; name?: string; group?: string; frameAction?: string; enabled?: boolean; edit?: string; cue?: string }
function trigXml(owner: string, t: TrigParts): string {
  const shape = t.shape ?? 'setStateName="" setstateop="ass" stateInclude="all" statesNot="are" stateName=""';
  const other = t.other ?? 'op="ass" varVal1="" useVar="false" dblVal="0" boolVal="True"';
  return `<trig g="${t.g ?? guid()}" verG="${guid()}" name="${t.name ?? ''}" type="user" edit="${t.edit ?? 'all'}" group="${t.group ?? 'none'}" copiedG="${owner}"><data enabled="${t.enabled === false ? 'false' : 'true'}" event="${t.event}" action="${t.action}" actSubType="${t.sub ?? 'next'}" NavigationIntent="${t.intent ?? 'Unspecified'}" NavigationState="${t.navState ?? 'None'}"><keyPress keys="None" case="false" /><slide ${t.slide ?? ''}showNav="false" /><scene /><shape ${shape}><stateLst /><dropLst /><intersectLst /><stopIntersectLst /><hoverLst /></shape><clickLst /><sldLayer ${t.layer ?? ''}/><video /><audio /><other open="" email="" js="" ${other} positiveCompletion="true" time="PT0S" cuePoint="${t.cue ?? '-2147483648'}" useRandom="false" randomMin="0" randomMax="0" /><interaction /><SeekTimeline target="${ZERO}" timeSeconds="0" cuePoint="-1" variableReference="false" useRelativeTime="false" relativeTime="NaN" modifyPlaybackState="false" playbackState="Play" /><frame ${t.frameAction ? `actionG="${t.frameAction}" ` : ''}restore="true" /></data>${t.cond ? `<condLst>${t.cond}</condLst>` : '<condLst />'}</trig>`;
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
    default: return `action "${a.type}"`;
  }
}

const COND_OPS: Record<string, string> = { eq: 'eq', lt: 'lt', gt: 'gt' };
function condXml(ctx: Ctx, conds: Condition[], logic: 'and' | 'or'): string | null {
  let out = '';
  for (const c of conds) {
    const v = ctx.project.variables.find((x) => x.id === c.variableId);
    const op = COND_OPS[c.operator ?? 'eq'];
    if (c.blockId || !v || !op) return null;
    const value = c.value ?? c.equals;
    const num = v.type === 'number' ? Number(value) || 0 : v.type === 'boolean' ? (value ? 1 : 0) : 0;
    out += `<trigCond ${gv()} lightBox="false" op="${op}" strVal1="${v.type === 'string' ? xa(String(value ?? '')) : ''}" strVal2="" floatVal1="${n(num)}" floatVal2="0" boolVal="" varG="${ctx.varG.get(v.id)}" varG2="${ZERO}" dataType="value" andOr="${logic}"><shapeState shapeG="${ZERO}" op="eq" name="Normal" /></trigCond>`;
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
        case 'onAnimationComplete': if (src) push(blockTrigs, t.sourceBlockId!, trigXml(src, { ...base, event: 'OnAnimationComplete' })); break;
        case 'onBlockEnters': if (src) push(blockTrigs, t.sourceBlockId!, trigXml(src, { ...base, event: 'OnStart' })); break;
        case 'onSlideLoad': case 'onTimelineStart': slideTrigs += trigXml(slideG, { ...base, event: 'OnStart' }); break;
        case 'onTimelineEnd': slideTrigs += trigXml(slideG, { ...base, event: 'OnEnd', cue: '0' }); break;
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

async function shapeList(ctx: Ctx, layer: Layer, totalMs: number, blockTrigs: Map<string, string>): Promise<string> {
  let out = '';
  const blocks = flatBlocks(layer.blocks).filter((b) => !(b.type === 'audio'));
  let z = 0;
  for (const b of blocks) out += await shapeXml(ctx, b, z++, totalMs, blockTrigs.get(b.id) ?? '');
  if (flatBlocks(layer.blocks).some((b) => b.type === 'audio')) warn(ctx, 'audio was left out: adding narration needs Storyline itself (Insert > Audio)');
  return out ? `<shapeLst>${out}</shapeLst>` : '<shapeLst />';
}

async function slideXml(ctx: Ctx, slide: Slide, layoutG: string): Promise<string> {
  const g = ctx.slideG.get(slide.id)!;
  const totalMs = Math.max(5000, Math.round((slide.timeline?.duration ?? 5) * 1000));
  const { slideTrigs, layerTrigs, blockTrigs, customNext } = sortTriggers(ctx, slide);
  const base = await shapeList(ctx, slide.layers[0], totalMs, blockTrigs);
  let layers = '';
  for (const [i, layer] of slide.layers.slice(1).entries()) {
    const lg = ctx.layerG.get(layer.id)!;
    const lMs = Math.max(5000, Math.round((layer.timeline?.duration ?? 5) * 1000));
    const shapes = await shapeList(ctx, layer, lMs, blockTrigs);
    const lt = layerTrigs.get(layer.id);
    layers += `<sldLayer g="${lg}" verG="${guid()}" timeManagerVisibilityLocked="false" typeName="" id="${i + 1}" state="0" showMasterSp="false" name="${xa(layer.name)}" role="" resetMode="y" layoutG="${layoutG}" stateG="${ZERO}" showPlay="false" clrScheme="def" isDrawingThemeUpgraded="true" resetModeInheritable="y" modal="${layer.modal ? 'true' : 'false'}" pause="${layer.pauseBase ? 'true' : 'false'}" stop="true" hideEnd="false" top="true" seek="y" presentAs="Layer" labeledBy="${ZERO}" describedBy="${ZERO}" seekInheritable="y"><tmProps ${gv()} cur="0" min="${lMs}" visible="true" hideAll="false"><markers nextId="0" /></tmProps><tmCtxLst version="1"><tmCtx ${gv()} start="0" dur="0" min="250" max="0" hasMax="false" alwysShw="false" untilEnd="false" assetStart="0" name="" /></tmCtxLst><sz w="0" h="0" /><bg>${SLIDE_BG.replace('3.4028235E+38', BIG)}${SHDW_NONE}</bg>${shapes}${lt ? `<trigLst>${lt}</trigLst>` : '<trigLst />'}<trans /><thumbProv g="${guid()}" sz="30" /></sldLayer>`;
  }
  const bg = slide.background?.type === 'color' && slide.background.color && hex6(slide.background.color, 'FFFFFF') !== 'FFFFFF'
    ? `<solidFill><clr><srgbClr val="${hex6(slide.background.color, 'FFFFFF')}" /></clr></solidFill>${SLIDE_BG}`
    : SLIDE_BG;
  if (slide.background && slide.background.type !== 'color') warn(ctx, 'gradient and picture slide backgrounds were left out');
  const nav = `${customNext ? '' : defaultNext(g)}${defaultPrev(g)}`;
  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?><sld g="${g}" verG="${guid()}" timeManagerVisibilityLocked="true" typeName="" id="0" state="0" showMasterSp="false" name="${xa(slide.name)}" role="" resetMode="auto" layoutG="${layoutG}" stateG="${ZERO}" showPlay="false" clrScheme="def" isDrawingThemeUpgraded="true" assetG="${ZERO}" backVis="trans" layoutType="Content" hideToc="${slide.lightbox ? 'true' : 'false'}" advMode="${slide.timeline?.autoAdvance ? 'auto' : 'user'}" linkType="none" showInReview="true" includeInSlideCounts="true" zoomTransDur="1000" useNextTrans="true"><tmProps ${gv()} cur="0" min="${totalMs}" visible="true" hideAll="false" /><sz w="0" h="0" /><bg>${bg}</bg>${base}<trigLst>${nav}${slideTrigs}</trigLst><localizedName /><trans />${noteXml(slide.notes)}${layers ? `<sldLayerLst>${layers}</sldLayerLst>` : ''}<thumb g="${guid()}" sz="300" /><localizedNote /><panTime ${gv()} timeManagerVisibilityLocked="false" typeName="" hide="false" lock="false"><tmProps ${gv()} cur="0" min="5000" visible="true" hideAll="false" /><tmCtxLst version="0" /></panTime><panRect g="${guid()}"><rect l="0" t="0" r="0" b="0" /></panRect></sld>`;
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
    slideG: new Map(), layerG: new Map(), blockG: new Map(), varG: new Map(), media: new Map(), slideMedia: new Set()
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

  const shellSlideRel = /<Relationship Type="slide" Target="[^"]+" Id="([^"]+)"/.exec(await read('story/_rels/story.xml.rels'))?.[1] ?? shortId(11, 'R');
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
    // The first slide keeps the shell's relationship id: the summary's start
    // path names it.
    const id = i === 0 ? shellSlideRel : shortId(11, 'R');
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
  const now = new Date().toISOString().replace('Z', '0000-00:00');
  const mediaXml = [...ctx.media.values()].map((m) =>
    `<media g="${m.g}" verG="${guid()}" type="Png" displayName="${xa(m.name)}" origFile="${xa(m.name)}" source="${xa(m.name)}" useCnt="0" bytes="${m.bytes.length}" modDT="${now}" addDT="${now}"><md5Checksum><stream>${m.hash}</stream><source>${m.hash}</source></md5Checksum></media>`).join('');
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
  void oldG;
  put('docProps/summary.xml', BOM + summary);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/octet-stream' });
  return { blob, warnings: [...ctx.warnings].map(([m, c]) => (c > 1 ? `${m} (${c} times)` : m)) };
}
