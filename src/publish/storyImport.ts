import JSZip from 'jszip';
import type {
  Action, AnimDirection, AnimSpec, Block, BlockState, BlockTiming, Condition, ConditionOperator,
  Layer, Project, Slide, SlideBackground, StateStyle, StyledState, Trigger, Variable, VariableValue
} from '../schema/types';
import { createLayer, uid } from '../schema/factory';
import { PRSTGEOM_TO_KIND } from '../blocks/shape/geometry';
import { md5 } from './md5';

// Articulate Storyline import. A .story file is a zip of XML (the same
// package family as .pptx):
//   story/story.xml            variables, scenes (slide order), media list
//   story/slides/slideN.xml    one slide: shapes, layers, triggers, notes
//   story/slideMasters/*.xml   theme colours and fonts
//   story/media/*              pictures, audio and video
// Things worth knowing about the format:
// - Slide order comes from the scenes in story.xml, never from file names.
// - A picture points at its file by MD5: the shape carries an asset id, the
//   media list maps that id to a checksum, and the file with that checksum
//   is the picture.
// - Text is an escaped XML document (Document > Content > Block > Span).
// - Positions are slide pixels (loc l/t/r/b); times are milliseconds.
// - Each shape, layer and slide has a GUID ("g"); triggers refer to those.
// This is an editable approximation, like the PowerPoint import. Anything
// with no eLearnForge equivalent is kept as a JavaScript trigger that says
// what the original did, and listed in the warnings.

const PT_TO_PX = 4 / 3;
// Storyline point sizes are defined on a 960-wide slide and grow with the
// slide, so a 1920-wide story renders the same number twice as large.
let fontScale = 1;
const ZERO_G = '00000000-0000-0000-0000-000000000000';

export interface StoryImportResult {
  project: Project;
  warnings: string[];
}

// ---------- small XML helpers ----------
const kids = (el: Element | null | undefined, tag?: string): Element[] =>
  el ? Array.from(el.children).filter((c) => !tag || c.localName === tag) : [];
const kid = (el: Element | null | undefined, tag: string): Element | undefined => kids(el, tag)[0];
const num = (el: Element | null | undefined, attr: string, fallback = 0): number => {
  const v = Number(el?.getAttribute(attr));
  return Number.isFinite(v) ? v : fallback;
};
function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text.replace(/^\uFEFF/, ''), 'application/xml');
}
async function readText(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.file(path.replace(/^\//, ''));
  return f ? f.async('string') : null;
}
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// "PT0.75S" / "PT1M2S" -> seconds
function isoSeconds(v: string | null | undefined, fallback: number): number {
  const m = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(v ?? '');
  if (!m) return fallback;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

// ---------- theme ----------
interface Theme { colors: Record<string, string>; major: string; minor: string }
const DEFAULT_THEME: Theme = {
  colors: { dk1: '#000000', lt1: '#FFFFFF', dk2: '#1F497D', lt2: '#EEECE1', accent1: '#4F81BD', accent2: '#C0504D', accent3: '#9BBB59', accent4: '#8064A2', accent5: '#4BACC6', accent6: '#F79646', hlink: '#0000FF' },
  major: 'Open Sans', minor: 'Open Sans'
};

function readTheme(master: Document | null): Theme {
  if (!master) return DEFAULT_THEME;
  const colors = { ...DEFAULT_THEME.colors };
  const list = master.getElementsByTagName('clrLst')[0];
  for (const c of kids(list)) {
    const rgb = kid(c, 'srgbClr')?.getAttribute('val');
    if (rgb) colors[c.localName] = `#${rgb}`;
  }
  const fonts = master.getElementsByTagName('fonts')[0];
  return {
    colors,
    major: fonts?.getAttribute('major') || DEFAULT_THEME.major,
    minor: fonts?.getAttribute('minor') || DEFAULT_THEME.minor
  };
}

function mixHex(hex: string, to: number, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// <clr><srgbClr val/> | <schemeClr val/> then modifiers (tint, shade, alpha)
function colorOf(clr: Element | undefined, theme: Theme): string | null {
  if (!clr) return null;
  let hex: string | null = null;
  const rgb = kid(clr, 'srgbClr')?.getAttribute('val');
  if (rgb) hex = `#${rgb}`;
  const scheme = kid(clr, 'schemeClr')?.getAttribute('val');
  if (!hex && scheme) hex = theme.colors[scheme] ?? null;
  if (!hex) return null;
  const tint = kid(clr, 'tint'); // percent * 1000 of the colour kept, rest white
  if (tint) hex = mixHex(hex, 255, 1 - num(tint, 'val', 100000) / 100000);
  const shade = kid(clr, 'shade');
  if (shade) hex = mixHex(hex, 0, 1 - num(shade, 'val', 100000) / 100000);
  const alpha = kid(clr, 'alpha');
  if (alpha) {
    const a = Math.max(0, Math.min(1, num(alpha, 'val', 100000) / 100000));
    if (a < 1) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Number(a.toFixed(2))})`;
    }
  }
  return hex;
}

// Text colours are "#RRGGBB" or "accent1,00" (a theme colour and a variant).
function textColor(v: string | null, theme: Theme): string | null {
  if (!v) return null;
  const name = v.split(',')[0].trim();
  if (name.startsWith('#')) return name.slice(0, 7);
  return theme.colors[name] ?? null;
}

interface Paint { fill: string | null; fillImageG: string | null; border: string | null; borderWidth: number }
function paintOf(shape: Element, theme: Theme): Paint {
  const bG = kid(shape, 'bG');
  const out: Paint = { fill: null, fillImageG: null, border: null, borderWidth: 0 };
  if (!bG) return out;
  const solid = kid(bG, 'solidFill');
  const grad = kid(bG, 'gradFill');
  const pic = kid(bG, 'picFill');
  if (kid(bG, 'noFill')) out.fill = 'transparent';
  else if (solid) out.fill = colorOf(kid(solid, 'clr'), theme);
  else if (grad) out.fill = colorOf(kid(kids(kid(grad, 'stops'), 'stop')[0], 'clr'), theme);
  else if (pic) out.fillImageG = pic.getAttribute('assetG');
  const line = kid(bG, 'solidLine') ?? kid(bG, 'gradLine');
  if (line && !kid(bG, 'noLine')) {
    out.border = colorOf(kid(line, 'clr'), theme) ?? colorOf(kid(kids(kid(line, 'stops'), 'stop')[0], 'clr'), theme);
    const w = num(kid(bG, 'lineStyle'), 'w', 0);
    out.borderWidth = out.border ? Math.max(1, Math.round((w || 0.75) * PT_TO_PX)) : 0;
  }
  return out;
}

// ---------- rich text ----------
interface TextResult { html: string; fontSize: number; align: 'left' | 'center' | 'right'; color: string | null; font: string | null; lineHeight: number | null }

function parseText(escaped: string | null | undefined, theme: Theme, fonts: Set<string>): TextResult | null {
  if (!escaped || !escaped.trim()) return null;
  const doc = parseXml(escaped);
  const blocks = Array.from(doc.getElementsByTagName('Block'));
  const parts: string[] = [];
  let firstSize = 0;
  let firstColor: string | null = null;
  let firstFont: string | null = null;
  let align: TextResult['align'] = 'left';
  let lineHeight: number | null = null;
  let atLeastPt = 0; // "at least" spacing: the whole line height in points
  let any = false;
  let listOpen: '' | 'ul' | 'ol' = '';

  blocks.forEach((block, bi) => {
    const pStyle = kid(block, 'Style');
    const just = pStyle?.getAttribute('Justification');
    const pAlign = just === 'Center' ? 'center' : just === 'Right' ? 'right' : 'left';
    if (bi === 0) {
      align = pAlign;
      if (pStyle?.getAttribute('LineSpacingRule') === 'AtLeast') atLeastPt = num(pStyle, 'LineSpacing', 0);
      if (pStyle?.getAttribute('LineSpacingRule') === 'Multiple') {
        // Storyline stores "Multiple" spacing as twentieths: 20 = single.
        const ls = num(pStyle, 'LineSpacing', 20) / 20;
        if (ls > 0.5 && ls < 4) lineHeight = Number((ls * 1.2).toFixed(2));
      }
    }
    const listType = kid(pStyle, 'ListStyle')?.getAttribute('ListType') ?? 'None';
    const list: '' | 'ul' | 'ol' = listType === 'None' ? '' : listType === 'Bullet' ? 'ul' : 'ol';

    const runs: string[] = [];
    const spans = kids(block, 'Span');
    for (const span of spans) {
      const text = span.getAttribute('Text') ?? '';
      if (!text) continue;
      const st = kid(span, 'Style');
      let css = '';
      const size = num(st, 'FontSize', 0);
      const px = size ? Math.round(size * PT_TO_PX * fontScale) : 0;
      const color = textColor(st?.getAttribute('ForegroundColor') ?? null, theme);
      let family = st?.getAttribute('FontFamily') ?? '';
      if (family === '+major') family = theme.major;
      else if (family === '+minor' || family.startsWith('+')) family = theme.minor;
      if (!firstSize && px) { firstSize = px; firstColor = color; firstFont = family || null; }
      if (px && px !== firstSize) css += `font-size: ${px}px;`;
      if (color && color !== firstColor) css += `color: ${color};`;
      if (family && family !== firstFont) css += `font-family: ${family};`;
      if (family) fonts.add(family);
      // Each paragraph's last run ends in a line-feed; it is the paragraph
      // break, not an extra line.
      const isLast = span === spans[spans.length - 1];
      let part = escapeHtml(isLast ? text.replace(/\r?\n$/, '') : text).replace(/\r?\n/g, '<br/>');
      if (css) part = `<span style="${css}">${part}</span>`;
      const elev = st?.getAttribute('Elevation');
      if (elev === 'Superscript') part = `<sup>${part}</sup>`;
      else if (elev === 'Subscript') part = `<sub>${part}</sub>`;
      if (st?.getAttribute('FontIsBold') === 'True') part = `<strong>${part}</strong>`;
      if (st?.getAttribute('FontIsItalic') === 'True') part = `<em>${part}</em>`;
      if (st?.getAttribute('FontIsUnderline') === 'True') part = `<u>${part}</u>`;
      if (st?.getAttribute('FontIsStrikeout') === 'True') part = `<s>${part}</s>`;
      runs.push(part);
    }
    if (runs.length) any = true;

    if (list !== listOpen) {
      if (listOpen) parts.push(`</${listOpen}>`);
      if (list) parts.push(`<${list}>`);
      listOpen = list;
    }
    const style = pAlign !== align ? ` style="text-align: ${pAlign};"` : '';
    if (list) parts.push(`<li${style}>${runs.join('')}</li>`);
    else parts.push(`<p${style}>${runs.join('') || '<br/>'}</p>`);
  });
  if (listOpen) parts.push(`</${listOpen}>`);
  if (!any) return null;
  if (atLeastPt && firstSize) {
    const lh = (atLeastPt * PT_TO_PX * fontScale) / firstSize;
    if (lh > 1.25 && lh < 4) lineHeight = Number(lh.toFixed(2));
  }
  // A result slide reads the quiz through Storyline's own variables; here
  // the score and pass mark are built-in references, both in percent.
  const html = parts.join('').replace(/%\w+\.(ScorePercent|ScorePoints)%/g, '%Score%').replace(/%\w+\.(PassPercent|PassPoints)%/g, '%PassPercent%');
  return { html, fontSize: firstSize || 16, align, color: firstColor, font: firstFont, lineHeight };
}

// ---------- animation ----------
const SIDE: Record<string, AnimDirection> = { b: 'up', t: 'down', l: 'right', r: 'left' };
function animOf(group: Element | undefined): AnimSpec | undefined {
  const fx = kids(group)[0];
  if (!fx) return undefined;
  const duration = isoSeconds(fx.getAttribute('dur'), 0.75);
  const base = { duration, ease: 'power2.out' };
  switch (fx.localName) {
    case 'fade': return { type: 'fade', ...base };
    case 'fly': return { type: 'slide', ...base, direction: SIDE[fx.getAttribute('dir') ?? 'b'] ?? 'up' };
    case 'float': return { type: 'rise', ...base, direction: fx.getAttribute('dir') === 'desc' ? 'down' : 'up' };
    case 'wipe': return { type: 'wipe', ...base, direction: SIDE[fx.getAttribute('wd') ?? 'l'] ?? 'right' };
    case 'growShrink': case 'grow': return { type: 'grow', ...base };
    case 'zoom': return { type: 'zoom', ...base };
    case 'spin': case 'spinGrow': case 'growTurn': return { type: 'spin', ...base };
    case 'bounce': return { type: 'bounceIn', ...base };
    case 'swivel': return { type: 'swivel', ...base };
    default: return { type: 'fade', ...base };
  }
}

// ---------- import context ----------
// A freeform pick-one / pick-many question: which shapes are the choices,
// which are right, and which layers give the feedback.
interface PickQuestion {
  many: boolean;
  choices: { g: string; mainG: string; correct: boolean }[];
  correctLayerG: string; incorrectLayerG: string; tryLayerG: string; thanksLayerG: string;
}

interface Ctx {
  picks: Map<string, PickQuestion>;    // interaction g -> question
  zip: JSZip;
  warnings: string[];
  fonts: Set<string>;
  mediaByAsset: Map<string, string>;   // asset g -> zip path
  dataUrls: Map<string, string>;       // zip path -> data url
  slideByG: Map<string, string>;       // sld g -> our slide id
  layerByG: Map<string, string>;       // sldLayer g -> our layer id
  blocksByG: Map<string, string[]>;    // shape g -> our block ids
  varByG: Map<string, Variable>;
  captions: string | null;             // caption text of the last sound read (WebVTT)
  nativeIntr: Set<string>;             // questions rebuilt as a quiz block
  deadShapes: Set<string>;             // Submit buttons those blocks make redundant
  hasResults: boolean;                 // the file has a result slide
  hotspotQuestions: { spots: { g: string; correct: boolean }[]; correctLayerG: string; incorrectLayerG: string }[];
  scoreVars: Map<string, 'score' | 'pass'>; // Storyline's quiz variables
  passScore: number | null;
  droppedLayers: Set<string>;          // feedback layers those blocks replace
  note: (slide: string, msg: string) => void;
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime'
};
async function mediaDataUrl(ctx: Ctx, assetG: string | null | undefined): Promise<string | null> {
  if (!assetG) return null;
  const path = ctx.mediaByAsset.get(assetG);
  if (!path) return null;
  const hit = ctx.dataUrls.get(path);
  if (hit) return hit;
  const f = ctx.zip.file(path);
  if (!f) return null;
  const ext = path.split('.').pop()!.toLowerCase();
  const url = `data:${MIME[ext] ?? 'application/octet-stream'};base64,${await f.async('base64')}`;
  ctx.dataUrls.set(path, url);
  return url;
}

const SHAPE_TAGS: Record<string, string> = {
  rect: 'rect', roundRect: 'roundRect', oval: 'ellipse', triangle: 'triangle', rtTriangle: 'rtTriangle', diamond: 'diamond',
  pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon', star5: 'star5', rightArrow: 'rightArrow', leftArrow: 'leftArrow',
  upArrow: 'upArrow', downArrow: 'downArrow', chevron: 'chevron', parallelogram: 'parallelogram', trapezoid: 'trapezoid',
  heart: 'heart', cloud: 'cloud', plus: 'plus',
  // Corner variants with no exact match land as their nearest shape.
  snipSingleCorner: 'rect', snipSameSideCorner: 'rect', snipDiagonalCorner: 'rect',
  roundSingleCorner: 'roundRect', roundSameSideCorner: 'roundRect', roundDiagonalCorner: 'roundRect'
};

const STATE_NAMES: Record<string, BlockState> = { normal: 'normal', visited: 'visited', selected: 'selected', disabled: 'disabled', hidden: 'hidden' };

function timingOf(shape: Element): { timing?: BlockTiming; endMs: number } {
  const ctxEl = kids(kid(shape, 'tmCtxLst'))[0];
  const fx = kid(shape, 'animEffect');
  const animIn = animOf(kid(fx, 'entr'));
  const animOut = animOf(kid(fx, 'exit'));
  if (!ctxEl) return { timing: animIn || animOut ? { start: 0, animIn, animOut } : undefined, endMs: 0 };
  const start = num(ctxEl, 'start');
  const dur = num(ctxEl, 'dur');
  const untilEnd = ctxEl.getAttribute('untilEnd') !== 'false';
  const plain = start === 0 && untilEnd && !animIn && !animOut;
  const timing: BlockTiming | undefined = plain ? undefined : {
    start: start / 1000,
    ...(untilEnd ? {} : { end: (start + dur) / 1000 }),
    ...(animIn ? { animIn } : {}),
    ...(animOut ? { animOut } : {})
  };
  return { timing, endMs: start + dur };
}

function locOf(shape: Element): { x: number; y: number; w: number; h: number } {
  // A shape can hold more than one <loc> (text frames have their own); the
  // direct child is the object's box.
  const loc = kid(shape, 'loc');
  const l = num(loc, 'l'), t = num(loc, 't'), r = num(loc, 'r'), b = num(loc, 'b');
  return { x: Math.round(l), y: Math.round(t), w: Math.max(1, Math.round(r - l)), h: Math.max(1, Math.round(b - t)) };
}

function stateStylesOf(shape: Element, theme: Theme, fonts: Set<string>): Partial<Record<StyledState, StateStyle>> | undefined {
  const out: Partial<Record<StyledState, StateStyle>> = {};
  for (const st of kids(kid(shape, 'stateLst'), 'state')) {
    const key = (st.getAttribute('name') ?? '').toLowerCase();
    if (!['hover', 'down', 'visited', 'selected', 'disabled'].includes(key)) continue;
    const inner = kids(kid(st, 'shapeLst'))[0];
    const style: StateStyle = {};
    if (inner) {
      const paint = paintOf(inner, theme);
      if (paint.fill && paint.fill !== 'transparent') style.fill = paint.fill;
      if (paint.border) style.borderColor = paint.border;
      const text = parseText(kid(inner, 'text')?.textContent, theme, fonts);
      if (text?.color) style.textColor = text.color;
    }
    out[key as StyledState] = style;
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------- questions as native blocks ----------
// Storyline's form questions (and the freeform ones that are not a plain
// pick) carry their answers as data, so they come across as eLearnForge's own
// quiz blocks. The Storyline shapes that drew them are dropped in favour of
// the block.
const PICK_FORMS: Record<string, boolean> = { trueFalseIntr: false, multiChoiceIntr: false, whichWordIntr: false, multiRespIntr: true };
const SURVEY_FORMS = new Set(['pickOneIntr', 'pickManyIntr', 'likertIntr', 'rankingDrapDropIntr']);

interface NativeQuestion { block: Block | null; consumed: Set<string>; layers: string[] }

const escText = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// The words in a shape: its plain copy, or the runs of its rich text.
function wordsOf(el: Element | undefined): string {
  if (!el) return '';
  const plain = kid(el, 'plain')?.textContent?.trim();
  if (plain) return plain;
  // Radio buttons and check boxes keep their label on the Normal state.
  const inner = Array.from(el.getElementsByTagName('plain')).map((x) => x.textContent?.trim() ?? '').find(Boolean);
  if (inner) return inner;
  const rich = kid(el, 'text')?.textContent ?? '';
  // An accepted answer is stored as bare words, not rich text.
  if (rich.trim() && !rich.includes('<')) return rich.trim();
  return Array.from(rich.matchAll(/Text="([^"]*)"/g)).map((m) => m[1]).join('')
    .replace(/&#xA;|&#10;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
}
function unionBox(els: (Element | undefined)[]): { x: number; y: number; w: number; h: number } {
  const boxes = els.filter((e): e is Element => !!e && !!kid(e, 'loc')).map(locOf).filter((b) => b.w > 0 && b.h > 0);
  if (!boxes.length) return { x: 80, y: 120, w: 800, h: 400 };
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}

function nativeQuestion(intr: Element, all: Element[], ctx: Ctx, slideName: string): NativeQuestion | null {
  const tag = intr.localName;
  const g = intr.getAttribute('g') ?? '';
  const props = kid(intr, 'intrProps');
  const byG = (id: string | null | undefined) => (id && !id.startsWith('00000000') ? all.find((e) => e.getAttribute('g') === id) : undefined);
  const children = all.filter((e) => e.getAttribute('parentG') === g);
  const byTop = (a: Element, b: Element) => locOf(a).y - locOf(b).y || locOf(a).x - locOf(b).x;
  const title = byG(props?.getAttribute('titleBoxG'));
  const question = wordsOf(title);
  const sld = intr.parentElement?.parentElement;
  // Feedback text lives on the question's Correct and Incorrect layers.
  const feedback = (attr: string, fallback: string) => {
    const lg = props?.getAttribute(attr);
    const layer = kids(kid(sld, 'sldLayerLst')).find((l) => l.getAttribute('g') === lg);
    const boxes = kids(kid(layer, 'shapeLst')).filter((e) => e.localName === 'feedbackTextBox' || e.localName === 'textBox').map(wordsOf).filter(Boolean);
    return boxes[boxes.length - 1] || fallback;
  };
  const fb = () => ({ feedbackCorrect: feedback('corFbG', 'That is right.'), feedbackIncorrect: feedback('incFbG', 'That is not right.') });
  const layers = ['corFbG', 'incFbG', 'tryFbG'].map((a) => props?.getAttribute(a) ?? '').filter((x) => x && !x.startsWith('00000000'));
  const consumed = new Set<string>();
  const eat = (...els: (Element | undefined)[]) => els.forEach((e) => { if (e) consumed.add(e.getAttribute('g') ?? ''); });
  const make = (type: string, box: { x: number; y: number; w: number; h: number }, p: Record<string, unknown>, name: string): NativeQuestion =>
    ({ block: { id: uid('blk'), type, name, ...box, props: p } as unknown as Block, consumed, layers });

  if (tag in PICK_FORMS) {
    const shapes = children.filter((e) => ['radio', 'checkBox', 'wordBankItem'].includes(e.localName)).sort(byTop);
    if (shapes.length < 2) return null;
    const choices = shapes.map((e, i) => ({ id: uid('c'), text: wordsOf(e) || (tag === 'trueFalseIntr' ? ['True', 'False'][i] ?? `Choice ${i + 1}` : `Choice ${i + 1}`) }));
    let right = shapes.map((e, i) => (kid(e, 'scoreData')?.getAttribute('correct') === 'true' ? choices[i].id : '')).filter(Boolean);
    // A word bank lists the right word first; it carries no per-word flag.
    if (!right.length && tag === 'whichWordIntr') right = [choices[shapes.indexOf(children.filter((e) => e.localName === 'wordBankItem')[0])]?.id ?? choices[0].id];
    if (!right.length) ctx.note(slideName, 'a question has no answer marked correct in the Storyline file; mark one in its properties');
    eat(...shapes, title, byG(intr.getAttribute('dropSpotG')));
    return make('multipleChoice', unionBox([intr, title]), { question, choices, correctChoiceIds: right, allowMultiple: PICK_FORMS[tag], ...fb() }, 'Question');
  }

  if (tag === 'matchDragDropIntr' || tag === 'matchDropDownIntr') {
    let pairs: { id: string; left: string; right: string }[] = [];
    if (tag === 'matchDragDropIntr') {
      const rows = children.filter((e) => e.localName === 'matchDragDropItem').sort(byTop);
      pairs = rows.map((row) => {
        const kidsG = kids(kid(row, 'childLst'), 'g').map((c) => byG(c.textContent));
        eat(row, ...kidsG);
        return { id: uid('p'), left: wordsOf(kidsG.find((e) => e?.localName === 'matchDropArea')), right: wordsOf(kidsG.find((e) => e?.localName === 'matchDragItem')) };
      });
    } else {
      const labels = children.filter((e) => e.localName === 'intrLabelDropDown');
      const combos = all.filter((e) => e.localName === 'comboMatch');
      pairs = labels.map((l, i) => ({ id: uid('p'), left: wordsOf(l), right: wordsOf(combos[i]) }));
      eat(...labels, ...combos);
    }
    pairs = pairs.filter((x) => x.left || x.right);
    if (pairs.length < 2) return null;
    eat(title);
    return make('matching', unionBox([intr, title]), { question, pairs, ...fb() }, 'Matching question');
  }

  if (tag === 'seqDragDropIntr' || tag === 'seqDropDownIntr') {
    const shapes = children.filter((e) => e.localName === 'seqDragDropItem' || e.localName === 'comboSeq').sort(byTop);
    if (shapes.length < 2) return null;
    eat(...shapes, title);
    return make('sequence', unionBox([intr, title]), { question, items: shapes.map((e) => ({ id: uid('s'), text: wordsOf(e) })), ...fb() }, 'Sequence question');
  }

  if (['textEntryIntr', 'freeTextEntryIntr', 'numericIntr', 'shortAnswerIntr', 'howManyIntr'].includes(tag)) {
    const entry = byG(intr.getAttribute('textEntryG')) ?? all.find((e) => e.localName === 'intrTextEntryBox' || e.localName === 'textEntry');
    const free = kids(kid(intr, 'choices'), 'intrFreeChoice');
    let answers = free.map(wordsOf).filter(Boolean);
    if (tag === 'numericIntr') {
      answers = free.filter((c) => c.getAttribute('compType') === 'eq').map((c) => c.getAttribute('numA') ?? '').filter(Boolean);
      if (free.some((c) => c.getAttribute('compType') !== 'eq')) ctx.note(slideName, 'a numeric question uses a range or comparison; only "equal to" answers were kept');
    }
    const size = Math.round(Math.max(14, Math.min(28, (entry ? locOf(entry).h : 40) * 0.45)));
    if (!answers.length) {
      // No right answer on file: a survey field, or a question nobody filled in.
      if (!entry) return null;
      if (['textEntryIntr', 'freeTextEntryIntr', 'numericIntr'].includes(tag)) ctx.note(slideName, 'a fill-in question has no accepted answers in the Storyline file; it was kept as a plain text field');
      eat(entry);
      return { ...make('textEntry', locOf(entry), { placeholder: 'Type your answer', fontSize: size, multiline: entry.getAttribute('multi') === 'true' }, 'Answer'), layers: [] };
    }
    const formTitle = tag === 'freeTextEntryIntr' ? undefined : title;
    eat(entry, formTitle);
    const box = formTitle ? unionBox([intr, formTitle]) : { ...locOf(entry!), h: Math.max(locOf(entry!).h, 150) };
    return make('fillBlank', box, { question: formTitle ? question : '', correctAnswers: answers, caseSensitive: intr.getAttribute('case') === 'true', fontSize: size, ...fb() }, 'Fill in the blank');
  }

  if (tag === 'dragDropIntr') {
    const free = kids(kid(intr, 'choices'), 'intrFreeChoice');
    const drags = free.map((c) => ({ shape: byG(c.getAttribute('shpG')), target: byG(c.getAttribute('matchShpG')) })).filter((d) => d.shape);
    const targetEls = [...new Set(drags.map((d) => d.target).filter((t): t is Element => !!t))];
    // Picture-only drag items have no words to rebuild a block from.
    if (drags.length < 2 || !targetEls.length || drags.some((d) => !wordsOf(d.shape))) return null;
    // Slots often all carry the same prompt ("Drop here") and are named by a
    // label beside them. When the slots do not tell each other apart, the
    // nearest label on the same row names the slot.
    const own = targetEls.map(wordsOf);
    const distinct = new Set(own.filter(Boolean)).size === targetEls.length;
    const used = new Set<Element>([...targetEls, ...drags.map((d) => d.shape!)]);
    const labelFor = (t: Element): Element | undefined => {
      const tb = locOf(t);
      return all.filter((e) => !used.has(e) && !e.localName.endsWith('Intr') && kid(e, 'loc') && wordsOf(e) && !kids(kid(e, 'trigLst'), 'trig').length)
        .map((e) => ({ e, b: locOf(e) }))
        .filter(({ b }) => Math.abs((b.y + b.h / 2) - (tb.y + tb.h / 2)) < tb.h / 2 && b.h < tb.h * 1.6 && b.x + b.w <= tb.x + 4)
        .sort((m, n) => (tb.x - (m.b.x + m.b.w)) - (tb.x - (n.b.x + n.b.w)))[0]?.e;
    };
    const labels = distinct ? [] : targetEls.map(labelFor);
    const targets = targetEls.map((t, i) => ({ id: uid('t'), label: (labels[i] ? wordsOf(labels[i]) : own[i]) || `Target ${i + 1}` }));
    const items = drags.map((d) => ({ id: uid('i'), text: wordsOf(d.shape), targetId: d.target ? targets[targetEls.indexOf(d.target)].id : '' }));
    labels.forEach((l) => { if (l) used.add(l); });
    eat(...used);
    const box = unionBox([...used]);
    // One item for every slot is a matching question.
    const oneEach = items.length === targets.length && targets.every((t) => items.filter((it) => it.targetId === t.id).length === 1);
    if (oneEach) {
      return make('matching', box, { question: '', pairs: targets.map((t) => ({ id: uid('p'), left: t.label, right: items.find((it) => it.targetId === t.id)!.text })), ...fb() }, 'Matching question');
    }
    return make('dragDrop', box, { question: '', items, targets, ...fb() }, 'Drag and drop');
  }

  if (tag === 'rsltsIntr') {
    // The result object is invisible; the slide around it does the showing.
    ctx.hasResults = true;
    return { block: null, consumed, layers: [] };
  }

  if (tag === 'hotSpotIntr' || tag === 'freeHotSpotIntr') {
    // Click a region, get the feedback layer straight away.
    const free = kids(kid(intr, 'choices'), 'intrFreeChoice').map((c) => ({ g: c.getAttribute('shpG') ?? '', correct: kid(c, 'scoringData')?.getAttribute('correct') === 'true' }));
    const form = all.filter((e) => e.localName.startsWith('clkArea') && kid(e, 'scoreData')).map((e) => ({ g: e.getAttribute('g') ?? '', correct: kid(e, 'scoreData')?.getAttribute('correct') === 'true' }));
    const spots = (free.length ? free : form).filter((x) => x.g && !x.g.startsWith('00000000'));
    if (!spots.length) return null;
    ctx.hotspotQuestions.push({ spots, correctLayerG: props?.getAttribute('corFbG') ?? '', incorrectLayerG: props?.getAttribute('incFbG') ?? '' });
    return { block: null, consumed, layers: [] };
  }

  if (SURVEY_FORMS.has(tag)) {
    // Ungraded: keep the wording visible instead of inventing a right answer.
    const likert = all.filter((e) => e.localName.startsWith('likert'));
    const shapes = (tag === 'likertIntr' ? likert.filter((e) => e.localName === 'likertStatement') : children.filter((e) => kid(e, 'loc'))).sort(byTop);
    if (tag === 'likertIntr') eat(...likert);
    const lines = shapes.map(wordsOf).filter(Boolean);
    if (!lines.length) return null;
    ctx.note(slideName, 'a survey question (no right answer) was kept as a list of its choices');
    eat(...shapes);
    return { ...make('text', locOf(intr), { html: `<ul>${lines.map((l) => `<li>${escText(l)}</li>`).join('')}</ul>`, fontSize: 20, align: 'left' }, 'Survey choices'), layers: [] };
  }
  return null;
}

async function importShapes(
  list: Element | undefined, ctx: Ctx, theme: Theme, slideName: string
): Promise<{ blocks: Block[]; endMs: number; hidden: string[]; popups: Layer[]; popupTriggers: Trigger[]; shapeTriggers: { owner: string; el: Element }[] }> {
  const blocks: Block[] = [];
  const popups: Layer[] = [];
  const popupTriggers: Trigger[] = [];
  const hidden: string[] = [];
  const shapeTriggers: { owner: string; el: Element }[] = [];
  let endMs = 0;

  // Questions that become one native block: work out which shapes they replace.
  const everything = kids(list);
  const natives = new Map<string, NativeQuestion>();
  const replaced = new Set<string>();
  for (const el of everything) {
    if (!el.localName.endsWith('Intr') || el.localName.startsWith('freePick')) continue;
    const n = nativeQuestion(el, everything, ctx, slideName);
    if (!n) continue;
    natives.set(el.getAttribute('g') ?? '', n);
    n.consumed.forEach((x) => replaced.add(x));
    n.layers.forEach((x) => ctx.droppedLayers.add(x));
    ctx.nativeIntr.add(el.getAttribute('g') ?? '');
  }

  for (const shape of everything) {
    const rawTag = shape.localName;
    const selfG = shape.getAttribute('g') ?? '';
    // Shapes a native block stands in for, and anything nested in them.
    if (replaced.has(selfG) || replaced.has(shape.getAttribute('parentG') ?? '')) { ctx.blocksByG.set(selfG, []); continue; }
    const native = natives.get(selfG);
    if (native) {
      if (native.block) blocks.push(native.block);
      ctx.blocksByG.set(selfG, native.block ? [native.block.id] : []);
      continue;
    }
    // Feedback layers use their own tag names for an ordinary text box and button.
    const tag = ({ feedbackTextBox: 'textBox', feedBackBtn: 'btn', rsltBtn: 'btn', aisound: 'sound' } as Record<string, string>)[rawTag] ?? rawTag;
    const g = shape.getAttribute('g') ?? '';
    const name = shape.getAttribute('name') || undefined;
    for (const t of kids(kid(shape, 'trigLst'), 'trig')) shapeTriggers.push({ owner: g, el: t });

    // A group is only a wrapper: its children are separate shapes in the same
    // list, already in slide coordinates.
    if (tag === 'group') {
      const children = kids(kid(shape, 'childLst'), 'g').map((c) => c.textContent ?? '');
      ctx.blocksByG.set(g, []);
      (shape as Element & { __children?: string[] }).__children = children;
      continue;
    }

    const box = locOf(shape);
    const rot = Number(shape.getAttribute('rot'));
    const rotation = Number.isFinite(rot) && rot > 0 ? rot : undefined;
    const { timing, endMs: end } = timingOf(shape);
    endMs = Math.max(endMs, end);
    const alt = kid(shape, 'alt')?.textContent?.split('\n')[0]?.trim();
    const common = {
      ...(name ? { name } : {}),
      ...(rotation ? { rotation } : {}),
      ...(timing ? { timing } : {})
    };
    const made: Block[] = [];

    if (tag === 'ph') continue; // an empty placeholder on a layout or master
    if (rawTag === 'freePickOneIntr' || rawTag === 'freePickManyIntr') {
      // The question itself is invisible: it only says which shapes are the
      // choices and which are right. The Submit trigger is built from it.
      const props = kid(shape, 'intrProps');
      ctx.picks.set(g, {
        many: rawTag === 'freePickManyIntr',
        choices: kids(kid(shape, 'choices'), 'intrFreeChoice').map((c) => ({
          g: c.getAttribute('shpG') ?? '', mainG: c.getAttribute('shpMainGrpG') ?? '',
          correct: kid(c, 'scoringData')?.getAttribute('correct') === 'true'
        })),
        correctLayerG: props?.getAttribute('corFbG') ?? '', incorrectLayerG: props?.getAttribute('incFbG') ?? '',
        tryLayerG: props?.getAttribute('tryFbG') ?? '', thanksLayerG: props?.getAttribute('thankFbG') ?? ''
      });
      ctx.blocksByG.set(g, []);
      continue;
    }
    if (tag === 'pic' || tag === 'svgimage') {
      const src = await mediaDataUrl(ctx, shape.getAttribute('assetG'));
      if (src) made.push({ id: uid('blk'), type: 'image', ...box, ...common, props: { src, fit: 'contain', alt: alt ?? '' } } as Block);
      else ctx.note(slideName, `picture "${name ?? ''}" has no media file in the package`);
    } else if (tag === 'video' || tag === 'audio' || tag === 'sound') {
      const src = await mediaDataUrl(ctx, shape.getAttribute('assetG'));
      if (!src) ctx.note(slideName, `${tag} "${name ?? ''}" has no media file in the package`);
      else if (tag === 'video') made.push({ id: uid('blk'), type: 'video', ...box, ...common, props: { src, controls: false, autoplay: true, loop: false } } as Block);
      else if (tag === 'sound') {
        // Captions travel as a WebVTT file the sound points at.
        const ccPath = ctx.mediaByAsset.get(kid(shape, 'sndProps')?.getAttribute('ccG') ?? '');
        const cc = ccPath ? await ctx.zip.file(ccPath)?.async('string') : null;
        if (cc && /-->/.test(cc)) ctx.captions = cc.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\nNOTE\n(?:.+\n)+/g, '\n');
      }
      if (src && tag !== 'video') made.push({ id: uid('blk'), type: 'audio', x: 20, y: 20, w: 240, h: 44, ...common, props: { src, controls: false, autoplay: true, label: name ?? 'Audio', hideInPlayer: true } } as Block);
    } else if (tag === 'btn') {
      const text = parseText(kid(shape, 'text')?.textContent, theme, ctx.fonts);
      const normal = kids(kid(shape, 'stateLst'), 'state').find((s) => s.getAttribute('name') === 'Normal');
      const paint = paintOf(kids(kid(normal, 'shapeLst'))[0] ?? shape, theme);
      const label = kid(shape, 'plain')?.textContent?.trim() || name || 'Button';
      made.push({
        id: uid('blk'), type: 'button', ...box, ...common,
        props: {
          label, variant: 'solid', fontSize: text?.fontSize ?? 16,
          ...(paint.fill && paint.fill !== 'transparent' ? { fill: paint.fill } : {}),
          ...(text?.color ? { textColor: text.color } : {})
        }
      } as Block);
    } else if (tag === 'line') {
      const paint = paintOf(shape, theme);
      made.push({
        id: uid('blk'), type: 'shape', ...box, w: Math.max(2, box.w), h: Math.max(2, box.h), ...common,
        props: {
          kind: 'rectangle', fill: 'transparent', borderColor: paint.border ?? '#000000', borderWidth: paint.borderWidth || 1, cornerRadius: 0,
          points: box.h <= 1 ? '0,50 100,50' : box.w <= 1 ? '50,0 50,100' : '0,0 100,100', isLine: true
        }
      } as Block);
    } else if (tag === 'textBox' || SHAPE_TAGS[tag] || kid(shape, 'prstGeom')) {
      const paint = paintOf(shape, theme);
      const text = parseText(kid(shape, 'text')?.textContent, theme, ctx.fonts);
      const isBox = tag === 'textBox';
      const kind = PRSTGEOM_TO_KIND[SHAPE_TAGS[tag] ?? 'rect'] ?? 'rectangle';
      const visible = (paint.fill && paint.fill !== 'transparent') || paint.borderWidth > 0 || paint.fillImageG;
      if (!isBox && !SHAPE_TAGS[tag]) ctx.note(slideName, `shape type "${tag}" imported as a rectangle`);
      if (paint.fillImageG) {
        const src = await mediaDataUrl(ctx, paint.fillImageG);
        if (src) made.push({ id: uid('blk'), type: 'image', ...box, ...common, props: { src, fit: 'cover', alt: alt ?? '', ...(kind !== 'rectangle' ? { clipKind: kind } : {}) } } as Block);
      } else if (visible || (!text && kids(kid(shape, 'stateLst')).length > 1)) {
        // A shape with nothing to show in its Normal state still has to exist
        // when other states draw it (a marker that appears when selected).
        const radius = tag.startsWith('round') ? Math.round(Math.min(box.w, box.h) * Math.min(0.5, num(kid(kid(shape, 'prstGeom'), 'roundRect'), 'radius', 0.12))) : 0;
        made.push({
          id: uid('blk'), type: 'shape', ...box, ...common,
          props: {
            kind, fill: paint.fill && paint.fill !== 'transparent' ? paint.fill : '#ffffff',
            ...(paint.fill === 'transparent' || !paint.fill ? { noFill: true } : {}),
            borderColor: paint.border ?? 'transparent', borderWidth: paint.borderWidth, cornerRadius: radius
          }
        } as Block);
      }
      if (text) {
        const margin = kid(shape, 'textMargin');
        const va = shape.getAttribute('vertAlign');
        const ha = shape.getAttribute('horzAlign');
        made.push({
          id: uid('blk'), type: 'text', ...box, w: Math.max(20, box.w), h: Math.max(16, box.h), ...common,
          ...(name ? { name: visible ? `${name} text` : name } : {}),
          props: {
            html: text.html, fontSize: text.fontSize,
            align: ha === 'c' ? 'center' : ha === 'r' ? 'right' : text.align,
            valign: va === 'm' ? 'center' : va === 'b' ? 'bottom' : va === 't' ? 'top' : isBox ? 'top' : 'center',
            lineHeight: text.lineHeight ?? 1.2,
            ...(text.color ? { color: text.color } : {}),
            ...(text.font ? { fontFamily: text.font } : {}),
            inset: { top: num(margin, 't'), right: num(margin, 'r'), bottom: num(margin, 'b'), left: num(margin, 'l') }
          }
        } as Block);
      }
    } else if (tag === 'clkAreaRect' || tag === 'clkAreaOval' || tag === 'clkAreaFreeform') {
      // A Storyline hotspot: an invisible click area.
      made.push({ id: uid('blk'), type: 'hotspot', ...box, ...common, props: { showHint: false, tooltip: name ?? '' } } as Block);
    } else if (tag === 'marker') {
      // A marker is a small icon that opens a label. Here: the icon, plus a
      // layer holding the label, shown when the icon is clicked and closed by
      // clicking the label.
      const paint = paintOf(shape, theme);
      const icon = await mediaDataUrl(ctx, paint.fillImageG);
      const dot: Block = icon
        ? { id: uid('blk'), type: 'image', ...box, ...common, props: { src: icon, fit: 'contain', alt: alt ?? name ?? 'More information', clipKind: 'ellipse' } } as Block
        : { id: uid('blk'), type: 'shape', ...box, ...common, props: { kind: 'ellipse', fill: theme.colors.accent1, borderColor: '#ffffff', borderWidth: 2, cornerRadius: 0 } } as Block;
      made.push(dot);
      const mp = kid(shape, 'markerProps');
      const title = parseText(kid(mp, 'title')?.textContent, theme, ctx.fonts);
      const desc = parseText(kid(mp, 'desc')?.textContent, theme, ctx.fonts);
      if (title || desc) {
        const sld = kid(shape, 'sldSz');
        const sw = num(sld, 'w', 960), sh = num(sld, 'h', 540);
        const pw = Math.min(sw - 16, Math.max(180, num(mp, 'lblW', 320)));
        const ph = Math.min(sh - 16, Math.max(80, num(mp, 'lblH', 160)));
        const pos = mp?.getAttribute('pos') ?? 'br';
        let px = pos.includes('l') ? box.x - pw - 8 : box.x + box.w + 8;
        let py = pos.includes('t') ? box.y - ph - 8 : box.y + box.h + 8;
        px = Math.max(8, Math.min(sw - pw - 8, px));
        py = Math.max(8, Math.min(sh - ph - 8, py));
        const bgEl = kid(mp, 'contentBg');
        const fill = colorOf(kid(kid(bgEl, 'solidFill'), 'clr'), theme) ?? '#FFFFFF';
        const line = colorOf(kid(kid(bgEl, 'solidLine'), 'clr'), theme) ?? '#333333';
        const layer = createLayer(`${name ?? 'Marker'} label`, false);
        const panel: Block = { id: uid('blk'), type: 'shape', x: px, y: py, w: pw, h: ph, name: 'Label', props: { kind: 'roundedRectangle', fill, borderColor: line, borderWidth: 1, cornerRadius: 6 } } as Block;
        layer.blocks.push(panel);
        const html = [title?.html, desc?.html].filter(Boolean).join('');
        const first = title ?? desc!;
        const text: Block = {
          id: uid('blk'), type: 'text', x: px, y: py, w: pw, h: ph, name: 'Label text',
          props: { html, fontSize: first.fontSize, align: 'left', valign: 'top', lineHeight: 1.25, scroll: true, ...(first.color ? { color: first.color } : {}), ...(first.font ? { fontFamily: first.font } : {}), inset: { top: 10, right: 12, bottom: 10, left: 12 } }
        } as Block;
        layer.blocks.push(text);
        popups.push(layer);
        popupTriggers.push({ id: uid('trg'), event: 'onClick', sourceBlockId: dot.id, conditions: [], actions: [{ type: 'showLayer', layerId: layer.id }] });
        for (const b of [panel, text]) popupTriggers.push({ id: uid('trg'), event: 'onClick', sourceBlockId: b.id, conditions: [], actions: [{ type: 'hideLayer', layerId: layer.id }] });
      }
    } else {
      // Web objects, sliders, dials, quiz widgets: keep a labelled
      // placeholder where the object was, so nothing silently disappears.
      ctx.note(slideName, `"${name ?? tag}" (${tag}) has no equivalent yet; a placeholder marks its position`);
      made.push({
        id: uid('blk'), type: 'shape', ...box, ...common, name: `${name ?? tag} (not converted)`,
        props: { kind: 'rectangle', fill: '#ffffff', noFill: true, borderColor: '#c2410c', borderWidth: 1, cornerRadius: 4 }
      } as Block);
    }

    const styles = stateStylesOf(shape, theme, ctx.fonts);
    if (styles) made.forEach((b) => { b.stateStyles = styles; });
    if (shape.getAttribute('initState') === 'Hidden') made.forEach((b) => hidden.push(b.id));
    ctx.blocksByG.set(g, made.map((b) => b.id));
    blocks.push(...made);
  }

  // A trigger aimed at a group acts on everything inside it.
  for (const shape of kids(list, 'group')) {
    const children = (shape as Element & { __children?: string[] }).__children ?? [];
    ctx.blocksByG.set(shape.getAttribute('g') ?? '', children.flatMap((c) => ctx.blocksByG.get(c) ?? []));
  }
  return { blocks, endMs, hidden, popups, popupTriggers, shapeTriggers };
}

// ---------- triggers ----------
const OPS: Record<string, ConditionOperator> = { eq: 'eq', ne: 'ne', neq: 'ne', lt: 'lt', gt: 'gt', lte: 'lte', gte: 'gte', le: 'lte', ge: 'gte' };

function varValue(v: Variable, other: Element | undefined, strAttr: string, numAttr: string): VariableValue {
  if (v.type === 'boolean') return (other?.getAttribute('boolVal') ?? '').toLowerCase() === 'true';
  if (v.type === 'number') return num(other, numAttr);
  return other?.getAttribute(strAttr) ?? '';
}

function describe(data: Element): string {
  const bits = [`${data.getAttribute('action')} on ${data.getAttribute('event')}`];
  const other = kid(data, 'other');
  for (const a of ['open', 'email', 'js']) { const v = other?.getAttribute(a); if (v) bits.push(`${a}: ${v}`); }
  return bits.join('; ');
}

function convertTrigger(
  trig: Element, owner: { kind: 'slide' | 'layer' | 'shape'; g: string }, ctx: Ctx, slideName: string, slideEl: Element
): Trigger[] {
  const data = kid(trig, 'data');
  if (!data) return [];
  const event = data.getAttribute('event') ?? '';
  const action = data.getAttribute('action') ?? '';
  const sub = data.getAttribute('actSubType') ?? '';
  const other = kid(data, 'other');
  const shapeEl = kid(data, 'shape');
  const enabled = data.getAttribute('enabled') !== 'false';
  const ownerBlocks = owner.kind === 'shape' ? ctx.blocksByG.get(owner.g) ?? [] : [];
  const unsupported = (why: string): Action[] => {
    ctx.note(slideName, `trigger kept as JavaScript: ${why}`);
    return [{ type: 'executeJs', code: `// Imported from Storyline, not converted: ${describe(data)}\n// ${why}` }];
  };

  // ----- actions
  let actions: Action[] = [];
  let submit: PickQuestion | null = null;
  const targets = (g: string | null | undefined) => (g && g !== ZERO_G ? ctx.blocksByG.get(g) ?? [] : []);
  switch (action) {
    case 'jumpToSlide': {
      const jump = kid(data, 'slide')?.getAttribute('jumpG');
      if (sub === 'next') actions = [{ type: 'nextSlide' }];
      else if (sub === 'prev') actions = [{ type: 'prevSlide' }];
      else if (jump && ctx.slideByG.has(jump)) actions = [{ type: 'goToSlide', slideId: ctx.slideByG.get(jump)! }];
      else actions = unsupported('the slide it jumps to was not found');
      break;
    }
    case 'showSubSlide': case 'hideSubSlide': {
      const lay = kid(data, 'sldLayer');
      const lg = lay?.getAttribute('showG') ?? lay?.getAttribute('hideG') ?? (owner.kind === 'layer' ? owner.g : null);
      const id = lg ? ctx.layerByG.get(lg) : undefined;
      actions = id ? [{ type: action === 'showSubSlide' ? 'showLayer' : 'hideLayer', layerId: id }] : unsupported('the layer was not found');
      break;
    }
    case 'adjustVar': {
      const v = ctx.varByG.get(other?.getAttribute('varG') ?? '');
      const op = other?.getAttribute('op') ?? 'ass';
      if (!v) actions = unsupported('it changes a built-in Storyline variable');
      else if (op === 'ass') actions = [{ type: 'setVariable', variableId: v.id, value: varValue(v, other, 'varVal1', 'dblVal') }];
      else if (v.type === 'number' && (op === 'add' || op === 'sub')) actions = [{ type: 'adjustVariable', variableId: v.id, delta: num(other, 'dblVal') * (op === 'sub' ? -1 : 1) }];
      else if (v.type === 'boolean' && (op === 'not' || op === 'tog')) actions = [{ type: 'executeJs', code: `forge.set(${JSON.stringify(v.name)}, !forge.get(${JSON.stringify(v.name)}));` }];
      else actions = unsupported(`variable operation "${op}" on ${v.name}`);
      break;
    }
    case 'changeShapeState': {
      const ids = targets(shapeEl?.getAttribute('setStateG'));
      const state = STATE_NAMES[(shapeEl?.getAttribute('setStateName') ?? '').toLowerCase()];
      if (ids.length && state) actions = ids.map((blockId) => ({ type: 'setState', blockId, state } as Action));
      else actions = unsupported(`state "${shapeEl?.getAttribute('setStateName')}" is a custom state`);
      break;
    }
    case 'LightboxSlide': {
      const id = ctx.slideByG.get(kid(data, 'slide')?.getAttribute('lightBoxG') ?? '');
      actions = id ? [{ type: 'openLightbox', slideId: id }] : unsupported('the lightbox slide was not found');
      break;
    }
    case 'submitInteraction': {
      const submitG = kid(data, 'interaction')?.getAttribute('submitG') ?? '';
      // A question rebuilt as a quiz block checks itself.
      if (ctx.nativeIntr.has(submitG)) { if (owner.kind === 'shape') ctx.deadShapes.add(owner.g); return []; }
      const q = ctx.picks.get(submitG);
      if (!q) { actions = unsupported('it submits a question type that is not converted yet'); break; }
      // Marked below: the one trigger becomes a "right answer" and a "wrong answer" trigger.
      actions = [{ type: 'executeJs', code: '// submit' }];
      submit = q;
      break;
    }
    case 'CloseLightbox': actions = [{ type: 'closeLightbox' }]; break;
    case 'CompleteCourse': actions = [{ type: 'completeCourse' }]; break;
    case 'ExitCourse': case 'closeWindow': actions = [{ type: 'exitCourse' }]; break;
    case 'Emphasize': {
      const ids = targets(kid(data, 'emphasisAnimationData')?.getAttribute('ShapeGuid'));
      actions = ids.length ? ids.slice(0, 1).map((blockId) => ({ type: 'pulseBlock', blockId, emphasis: 'pulse' } as Action)) : [];
      break;
    }
    case 'jumpToFileUrl': case 'jumpToUrl': {
      const url = other?.getAttribute('open') ?? '';
      actions = /^https?:/i.test(url) ? [{ type: 'openUrl', url }] : unsupported('it opens a local file, which is not in the package');
      break;
    }
    case 'executeJavaScript': case 'executeJavascript': case 'ExecuteJavascript': {
      const js = other?.getAttribute('js') ?? '';
      actions = [{ type: 'executeJs', code: `// Imported from Storyline. GetPlayer() calls need rewriting to forge.get / forge.set.\n${js}` }];
      break;
    }
    case 'pauseTimeline': actions = [{ type: 'pauseTimeline' }]; break;
    case 'resumeTimeline': actions = [{ type: 'resumeTimeline' }]; break;
    default: actions = unsupported(`action "${action}" has no equivalent`);
  }
  if (!actions.length) return [];

  // ----- conditions
  const conditions: Condition[] = [];
  let logic: 'and' | 'or' = 'and';
  for (const c of kids(kid(trig, 'condLst'), 'trigCond')) {
    if (c.getAttribute('andOr') === 'or') logic = 'or';
    const st = kid(c, 'shapeState');
    const stIds = targets(st?.getAttribute('shapeG'));
    const v = ctx.varByG.get(c.getAttribute('varG') ?? '');
    const operator = OPS[c.getAttribute('op') ?? 'eq'] ?? 'eq';
    if (stIds.length) {
      conditions.push({ variableId: '', blockId: stIds[0], blockState: STATE_NAMES[(st?.getAttribute('name') ?? '').toLowerCase()] ?? 'normal', operator: st?.getAttribute('op') === 'ne' ? 'ne' : 'eq' });
    } else if (v) {
      const value: VariableValue = v.type === 'boolean' ? (c.getAttribute('boolVal') ?? '').toLowerCase() === 'true' || num(c, 'floatVal1') === 1
        : v.type === 'number' ? num(c, 'floatVal1') : c.getAttribute('strVal1') ?? '';
      conditions.push({ variableId: v.id, operator, value });
    } else if (ctx.scoreVars.get(c.getAttribute('varG') ?? '') === 'score') {
      // "Score at least the pass mark", or a score against a number.
      const againstPass = ctx.scoreVars.get(c.getAttribute('varG2') ?? '') === 'pass';
      conditions.push({ variableId: '', score: true, operator, value: againstPass ? ctx.passScore ?? 80 : num(c, 'floatVal1') });
    } else {
      ctx.note(slideName, 'a trigger condition on a built-in Storyline variable was dropped');
    }
  }

  const base = { conditions, ...(logic === 'or' ? { conditionLogic: 'or' as const } : {}), ...(enabled ? {} : { enabled: false }) };
  const one = (extra: Partial<Trigger>): Trigger => ({ id: uid('trg'), event: 'onClick', ...base, actions, ...extra } as Trigger);
  const perSource = (ev: Trigger['event'], ids: string[]): Trigger[] => ids.map((id) => one({ event: ev, sourceBlockId: id }));

  // ----- events
  const built = ((): Trigger[] => { switch (event) {
    case 'OnClick': {
      // Storyline stores the Previous button as a slide-level click with a
      // "Previous" intent.
      if (owner.kind === 'slide' && data.getAttribute('NavigationIntent') === 'Previous') {
        return action === 'jumpToSlide' && sub === 'prev' ? [] : [one({ event: 'onBack' })];
      }
      const clicked = kids(kid(data, 'clickLst'), 'g').flatMap((c) => targets(c.textContent));
      const ids = ownerBlocks.length ? ownerBlocks : clicked;
      return ids.length ? perSource('onClick', ids) : [];
    }
    case 'OnMouseOver': case 'OnHover': case 'OnMouseHover': return perSource('onHover', ownerBlocks);
    case 'OnDoubleClick': return perSource('onDoubleClick', ownerBlocks);
    case 'OnAnimationComplete': return perSource('onAnimationComplete', ownerBlocks.slice(0, 1));
    case 'OnStart':
      if (owner.kind === 'shape') return perSource('onBlockEnters', ownerBlocks.slice(0, 1));
      if (owner.kind === 'slide') return [one({ event: 'onSlideLoad' })];
      return [one({ event: 'onLayerShown', layerId: ctx.layerByG.get(owner.g) })];
    case 'OnEnd':
      if (owner.kind === 'slide') return [one({ event: 'onTimelineEnd' })];
      ctx.note(slideName, 'a "when the timeline ends" trigger on a layer or object was switched off');
      return [one({ event: 'onTimelineEnd', enabled: false })];
    case 'OnStateChange': {
      const watch = kids(kid(shapeEl, 'stateLst'), 'g').flatMap((c) => targets(c.textContent).slice(0, 1));
      const state = STATE_NAMES[(shapeEl?.getAttribute('stateName') ?? '').toLowerCase()];
      if (watch.length && state) return [one({ event: 'onStateAll', watchBlockIds: watch, watchState: state })];
      ctx.note(slideName, 'a "when state changes" trigger on a custom state was dropped');
      return [];
    }
    case 'OnVarChange': case 'OnVariableChange': case 'OnVariableValueChange': {
      const v = ctx.varByG.get(other?.getAttribute('varChangeG') ?? other?.getAttribute('varG') ?? '');
      return [one({ event: 'onVariableChange', ...(v ? { watchVariableId: v.id } : {}) })];
    }
    case 'OnKeyPress': {
      const key = kid(data, 'keyPress')?.getAttribute('keys') ?? '';
      const named = ({ Right: 'ArrowRight', Left: 'ArrowLeft', Up: 'ArrowUp', Down: 'ArrowDown', Space: ' ' } as Record<string, string>)[key];
      return key && key !== 'None' ? [one({ event: 'onKeyPress', key: named ?? (key.length === 1 ? key.toLowerCase() : key) })] : [];
    }
    case 'OnNextButtonClick': case 'OnPrevButtonClick':
      // The player's own Next and Back already do this.
      if (action === 'jumpToSlide' && (sub === 'next' || sub === 'prev')) return [];
      return [one({ event: event === 'OnNextButtonClick' ? 'onNext' : 'onBack' })];
    case 'OnSubmitButtonClick': return [one({ event: 'onSubmit' })];
    default:
      ctx.note(slideName, `a trigger on "${event}" was switched off: that event has no equivalent`);
      void slideEl;
      return [one({ event: 'onSlideLoad', enabled: false })];
  } })();
  if (!submit) return built;

  // Submit on a pick question. Right means every correct choice is selected
  // and no wrong one is; anything else is wrong. A question with no correct
  // choice is a survey and only says thank you.
  const q: PickQuestion = submit;
  const main = (c: PickQuestion['choices'][number]) => (ctx.blocksByG.get(c.mainG) ?? ctx.blocksByG.get(c.g) ?? [])[0];
  const layer = (g: string) => (g && g !== ZERO_G ? ctx.layerByG.get(g) : undefined);
  const show = (g: string): Action[] => { const id = layer(g); return id ? [{ type: 'showLayer', layerId: id }] : []; };
  const picked = q.choices.map((c) => ({ id: main(c), correct: c.correct })).filter((c) => c.id);
  const out: Trigger[] = [];
  for (const t of built) {
    if (!picked.some((c) => c.correct)) {
      out.push({ ...t, id: uid('trg'), conditions: [], actions: show(q.thanksLayerG).length ? show(q.thanksLayerG) : [{ type: 'nextSlide' }] });
      continue;
    }
    const right: Condition[] = picked.map((c) => ({ variableId: '', blockId: c.id, blockState: 'selected', operator: c.correct ? 'eq' : 'ne' }));
    const wrong: Condition[] = picked.map((c) => ({ variableId: '', blockId: c.id, blockState: 'selected', operator: c.correct ? 'ne' : 'eq' }));
    const no = show(q.incorrectLayerG).length ? show(q.incorrectLayerG) : show(q.tryLayerG);
    if (show(q.correctLayerG).length) out.push({ ...t, id: uid('trg'), conditions: right, conditionLogic: 'and', actions: show(q.correctLayerG) });
    if (no.length) out.push({ ...t, id: uid('trg'), conditions: wrong, conditionLogic: 'or', actions: no });
  }
  if (!out.length) ctx.note(slideName, 'a question has no feedback layers, so Submit does nothing');
  return out;
}

// Choices in a pick question select like radio buttons or checkboxes. A
// choice is often a group (button, letter badge, text), so a click on any
// part marks every part.
function pickSelectionTriggers(ctx: Ctx): Trigger[] {
  const out: Trigger[] = [];
  for (const q of ctx.picks.values()) {
    const parts = q.choices.map((c) => ctx.blocksByG.get(c.g) ?? []);
    parts.forEach((mine, i) => {
      const others = parts.flatMap((p, j) => (j === i ? [] : p));
      for (const b of mine) {
        if (q.many) {
          const siblings = mine.filter((x) => x !== b);
          if (!siblings.length) continue;
          out.push({ id: uid('trg'), event: 'onClick', sourceBlockId: b, conditions: [{ variableId: '', blockId: b, blockState: 'selected', operator: 'eq' }], actions: siblings.map((x) => ({ type: 'setState', blockId: x, state: 'selected' } as Action)) });
          out.push({ id: uid('trg'), event: 'onClick', sourceBlockId: b, conditions: [{ variableId: '', blockId: b, blockState: 'selected', operator: 'ne' }], actions: siblings.map((x) => ({ type: 'setState', blockId: x, state: 'normal' } as Action)) });
        } else {
          out.push({ id: uid('trg'), event: 'onClick', sourceBlockId: b, conditions: [], actions: [
            ...mine.map((x) => ({ type: 'setState', blockId: x, state: 'selected' } as Action)),
            ...others.map((x) => ({ type: 'setState', blockId: x, state: 'normal' } as Action))
          ] });
        }
      }
    });
  }
  return out;
}

function backgroundOf(bg: Element | undefined, theme: Theme): SlideBackground | undefined {
  const solid = kid(bg, 'solidFill');
  if (solid) { const c = colorOf(kid(solid, 'clr'), theme); if (c) return { type: 'color', color: c }; }
  const grad = kid(bg, 'gradFill');
  if (grad) {
    const stops = kids(kid(grad, 'stops'), 'stop');
    const from = colorOf(kid(stops[0], 'clr'), theme);
    const to = colorOf(kid(stops[stops.length - 1], 'clr'), theme);
    if (from && to) return { type: 'gradient', from, to, angle: num(grad, 'angle', 90) + 90 };
  }
  return undefined;
}

function notesOf(sld: Element): string {
  const raw = kid(sld, 'note')?.textContent;
  if (!raw || !raw.trim()) return '';
  const doc = parseXml(raw);
  return Array.from(doc.getElementsByTagName('Block'))
    .map((b) => kids(b, 'Span').map((s) => s.getAttribute('Text') ?? '').join(''))
    .join('\n').trim();
}

export async function importStory(file: File | Blob, fileName = 'course.story'): Promise<StoryImportResult> {
  const zip = await JSZip.loadAsync(file);
  const storyText = await readText(zip, 'story/story.xml');
  if (!storyText) throw new Error('This does not look like a Storyline file (story/story.xml is missing).');
  const story = parseXml(storyText).documentElement;
  const warnings: string[] = [];
  const perSlide = new Map<string, Map<string, number>>();
  const ctx: Ctx = {
    zip, warnings, fonts: new Set(), mediaByAsset: new Map(), dataUrls: new Map(),
    picks: new Map(), slideByG: new Map(), layerByG: new Map(), blocksByG: new Map(), varByG: new Map(), captions: null, nativeIntr: new Set(), deadShapes: new Set(), droppedLayers: new Set(), hasResults: false, hotspotQuestions: [], scoreVars: new Map(), passScore: null,
    note: (slide, msg) => {
      const m = perSlide.get(slide) ?? new Map<string, number>();
      m.set(msg, (m.get(msg) ?? 0) + 1);
      perSlide.set(slide, m);
    }
  };

  // Slide size
  let width = 960, height = 540;
  for (const sz of Array.from(kid(story, 'propLst')?.getElementsByTagName('sz') ?? [])) {
    if (num(sz, 'w') > 0 && num(sz, 'h') > 0) { width = Math.round(num(sz, 'w')); height = Math.round(num(sz, 'h')); break; }
  }

  fontScale = width / 960;

  // Variables: only the author's own. Built-ins (Player., Project. ...) stay behind.
  const variables: Variable[] = [];
  for (const v of kids(kid(story, 'varLst'), 'var')) {
    if (v.getAttribute('type') !== 'user') continue;
    const dt = v.getAttribute('dataType');
    const raw = v.getAttribute('val') ?? '';
    const type: Variable['type'] = dt === 'bool' ? 'boolean' : dt === 'num' ? 'number' : 'string';
    const variable: Variable = {
      id: uid('var'), name: v.getAttribute('name') ?? 'variable', type,
      defaultValue: type === 'boolean' ? raw.toLowerCase() === 'true' : type === 'number' ? Number(raw) || 0 : raw
    };
    variables.push(variable);
    ctx.varByG.set(v.getAttribute('g') ?? '', variable);
  }

  // Quizzes: which built-in variables hold the score and the pass mark.
  for (const quiz of Array.from(story.getElementsByTagName('quiz'))) {
    for (const a of ['scorePct', 'scorePoints']) ctx.scoreVars.set(quiz.getAttribute(a) ?? '', 'score');
    for (const a of ['passPct', 'passPoints']) ctx.scoreVars.set(quiz.getAttribute(a) ?? '', 'pass');
    if (ctx.passScore === null && quiz.hasAttribute('passScore')) ctx.passScore = num(quiz, 'passScore', 80);
  }

  // Media: checksum -> file, then asset id -> checksum.
  const byHash = new Map<string, string>();
  for (const path of Object.keys(zip.files)) {
    if (!/^story\/media\/[^/]+\.(png|jpe?g|gif|svg|webp|bmp|mp3|m4a|wav|ogg|mp4|webm|mov|vtt)$/i.test(path)) continue;
    byHash.set(md5(await zip.file(path)!.async('uint8array')), path);
  }
  const mediaEls = ['media', 'svgasset', 'audio', 'video'].flatMap((tag) => Array.from(story.getElementsByTagName(tag)));
  for (const m of mediaEls) {
    const hash = kid(kid(m, 'md5Checksum'), 'stream')?.textContent?.trim();
    const g = m.getAttribute('g');
    if (g && hash && byHash.has(hash)) ctx.mediaByAsset.set(g, byHash.get(hash)!);
  }

  // Slide order: scenes in story.xml hold relationship ids; the rels file maps them to parts.
  const relsText = await readText(zip, 'story/_rels/story.xml.rels');
  const relTarget = new Map<string, string>();
  if (relsText) {
    for (const r of Array.from(parseXml(relsText).getElementsByTagName('Relationship'))) {
      relTarget.set(r.getAttribute('Id') ?? '', (r.getAttribute('Target') ?? '').replace(/^\//, ''));
    }
  }
  const ordered: { path: string; scene: string }[] = [];
  for (const scene of kids(kid(story, 'sceneLst'), 'scene')) {
    for (const id of kids(kid(scene, 'sldIdLst'), 'sldId')) {
      const path = relTarget.get(id.textContent ?? '');
      if (path && zip.file(path)) ordered.push({ path, scene: scene.getAttribute('name') ?? '' });
    }
  }
  if (!ordered.length) throw new Error('No slides found in this Storyline file.');

  // Layouts and masters. A slide names its layout by the layout's
  // "internalG"; each master lists its layouts in its rels file. Masters carry
  // the theme colours and fonts, and both can carry artwork (logos, footers)
  // and a background that slides inherit.
  interface Master { el: Element; theme: Theme }
  const layouts = new Map<string, { el: Element; master: Master | null }>();
  let theme = DEFAULT_THEME;
  for (const path of Object.keys(zip.files).filter((p) => /^story\/slideMasters\/[^/]+\.xml$/.test(p)).sort()) {
    const t = await readText(zip, path);
    if (!t) continue;
    const doc = parseXml(t);
    const master: Master = { el: doc.documentElement, theme: readTheme(doc) };
    if (theme === DEFAULT_THEME && t.includes('<clrLst')) theme = master.theme;
    const rels = await readText(zip, path.replace(/([^/]+)$/, '_rels/$1.rels'));
    if (!rels) continue;
    for (const r of Array.from(parseXml(rels).getElementsByTagName('Relationship'))) {
      const lt = await readText(zip, r.getAttribute('Target') ?? '');
      if (!lt) continue;
      const lel = parseXml(lt).documentElement;
      const key = lel.getAttribute('internalG') ?? lel.getAttribute('g') ?? '';
      layouts.set(key, { el: lel, master });
      layouts.set(lel.getAttribute('g') ?? key, { el: lel, master });
    }
  }

  // Pass 1: parse every slide and reserve ids, so triggers can point anywhere.
  const parsed: { el: Element; slide: Slide; scene: string }[] = [];
  for (const { path, scene } of ordered) {
    const text = await readText(zip, path);
    if (!text) continue;
    const el = parseXml(text).documentElement;
    const slide: Slide = { id: uid('sld'), name: el.getAttribute('name') || 'Untitled slide', width, height, layers: [], triggers: [] };
    ctx.slideByG.set(el.getAttribute('g') ?? '', slide.id);
    parsed.push({ el, slide, scene });
  }

  const seenPicks = new Set<string>();
  // Pass 2: shapes and layers.
  const pending: { slide: Slide; name: string; el: Element; triggers: { owner: { kind: 'slide' | 'layer' | 'shape'; g: string }; el: Element }[] }[] = [];
  for (const { el, slide } of parsed) {
    const triggers: { owner: { kind: 'slide' | 'layer' | 'shape'; g: string }; el: Element }[] = [];
    const base = createLayer('Base layer', true);
    const layout = layouts.get(el.getAttribute('layoutG') ?? '');
    const slideTheme = layout?.master?.theme ?? theme;
    // Artwork inherited from the master and the layout sits under the slide's
    // own objects, locked so it is not dragged by accident.
    const inherited: Block[] = [];
    const inheritFrom = async (owner: Element | undefined) => {
      if (!owner) return;
      const res = await importShapes(kid(owner, 'shapeLst'), ctx, slideTheme, slide.name);
      res.blocks.forEach((b) => { b.locked = true; b.timing = undefined; });
      inherited.push(...res.blocks);
    };
    if (layout?.el.getAttribute('showMasterSp') === 'true') await inheritFrom(layout.master?.el);
    await inheritFrom(layout?.el);
    ctx.captions = null;
    const main = await importShapes(kid(el, 'shapeLst'), ctx, slideTheme, slide.name);
    const slideCaptions = ctx.captions as string | null;
    base.blocks = [...inherited, ...main.blocks];
    const startHidden = [...main.hidden];
    main.shapeTriggers.forEach((t) => triggers.push({ owner: { kind: 'shape', g: t.owner }, el: t.el }));
    for (const t of kids(kid(el, 'trigLst'), 'trig')) triggers.push({ owner: { kind: 'slide', g: el.getAttribute('g') ?? '' }, el: t });
    slide.layers.push(base);
    const popups: Layer[] = [...main.popups];
    slide.triggers.push(...main.popupTriggers);

    let endMs = main.endMs;
    const feedbackNames = new Map<string, string>();
    for (const intr of Array.from(el.getElementsByTagName('intrProps'))) {
      for (const [attr, label] of [['corFbG', 'Correct'], ['incFbG', 'Incorrect'], ['tryFbG', 'Try again'], ['thankFbG', 'Thank you']] as const) {
        feedbackNames.set(intr.getAttribute(attr) ?? '', label);
      }
    }
    for (const lay of kids(kid(el, 'sldLayerLst')).filter((l) => (l.localName === 'sldLayer' || l.localName === 'feedBackLayer') && !ctx.droppedLayers.has(l.getAttribute('g') ?? ''))) {
      const layer: Layer = createLayer(lay.getAttribute('name') || feedbackNames.get(lay.getAttribute('g') ?? '') || 'Layer', false);
      if (lay.getAttribute('modal') === 'true') layer.modal = true;
      const res = await importShapes(kid(lay, 'shapeLst'), ctx, slideTheme, slide.name);
      layer.blocks = res.blocks;
      startHidden.push(...res.hidden);
      if (res.blocks.some((b) => b.timing)) {
        layer.timeline = { duration: Math.max(1, res.endMs / 1000), autoAdvance: false };
        if (lay.getAttribute('pause') === 'true') layer.pauseBase = true;
      }
      const lg = lay.getAttribute('g') ?? '';
      ctx.layerByG.set(lg, layer.id);
      res.shapeTriggers.forEach((t) => triggers.push({ owner: { kind: 'shape', g: t.owner }, el: t.el }));
      for (const t of kids(kid(lay, 'trigLst'), 'trig')) triggers.push({ owner: { kind: 'layer', g: lg }, el: t });
      slide.layers.push(layer);
      popups.push(...res.popups);
      slide.triggers.push(...res.popupTriggers);
    }

    slide.layers.push(...popups);

    if (base.blocks.some((b) => b.timing) || el.getAttribute('advMode') === 'auto' || slideCaptions) {
      endMs = Math.max(endMs, num(kid(el, 'tmProps'), 'min', 0));
      slide.timeline = { duration: Math.max(1, endMs / 1000), autoAdvance: el.getAttribute('advMode') === 'auto' , ...(slideCaptions ? { captionsVtt: slideCaptions } : {}) };
    }
    // Objects whose initial state is Hidden start hidden here too.
    if (startHidden.length) {
      slide.triggers.push({ id: uid('trg'), event: 'onSlideLoad', conditions: [], actions: startHidden.map((blockId) => ({ type: 'hideBlock', blockId } as Action)) });
    }
    const notes = notesOf(el);
    if (notes) slide.notes = notes;
    const bg = backgroundOf(kid(el, 'bg'), slideTheme) ?? backgroundOf(kid(layout?.el, 'bg'), slideTheme) ?? backgroundOf(kid(layout?.master?.el, 'bg'), slideTheme);
    slide.background = bg ?? { type: 'color', color: '#FFFFFF' };
    const nav = kid(el, 'navData');
    if (nav && (nav.getAttribute('next') === 'false' || nav.getAttribute('prev') === 'false')) {
      slide.nav = {
        ...(nav.getAttribute('next') === 'false' ? { next: 'hide' as const } : {}),
        ...(nav.getAttribute('prev') === 'false' ? { back: 'hide' as const } : {})
      };
    }
    // Every block that is part of a choice needs a Selected state to toggle.
    const choiceIds = new Set([...ctx.picks.entries()].filter(([g]) => !seenPicks.has(g)).flatMap(([, q]) => q.choices.flatMap((c) => ctx.blocksByG.get(c.g) ?? [])));
    for (const layer of slide.layers) for (const b of layer.blocks) if (choiceIds.has(b.id)) b.stateStyles = { ...(b.stateStyles ?? {}), selected: b.stateStyles?.selected ?? {} };
    for (const hq of ctx.hotspotQuestions.splice(0)) {
      for (const spot of hq.spots) {
        const blockId = (ctx.blocksByG.get(spot.g) ?? [])[0];
        const layerId = ctx.layerByG.get(spot.correct ? hq.correctLayerG : hq.incorrectLayerG);
        if (blockId && layerId) slide.triggers.push({ id: uid('trg'), event: 'onClick', sourceBlockId: blockId, conditions: [], actions: [{ type: 'showLayer', layerId }] });
      }
    }
    const fresh = new Map([...ctx.picks].filter(([g]) => !seenPicks.has(g)));
    slide.triggers.push(...pickSelectionTriggers({ ...ctx, picks: fresh }));
    fresh.forEach((_, g) => seenPicks.add(g));
    pending.push({ slide, name: slide.name, el, triggers });
  }

  // Pass 3: triggers, now that every slide, layer and block has an id.
  const lightboxed = new Set<string>();
  const jumpedTo = new Set<string>();
  for (const p of pending) {
    for (const t of p.triggers) {
      for (const trig of convertTrigger(t.el, t.owner, ctx, p.name, p.el)) {
        p.slide.triggers.push(trig);
        for (const a of trig.actions) {
          if (a.type === 'openLightbox') lightboxed.add(a.slideId);
          if (a.type === 'goToSlide') jumpedTo.add(a.slideId);
        }
      }
    }
  }
  // A Submit button whose question now checks itself has nothing left to do.
  const dead = new Set([...ctx.deadShapes].flatMap((g) => ctx.blocksByG.get(g) ?? []));
  if (dead.size) {
    for (const p of pending) {
      for (const layer of p.slide.layers) layer.blocks = layer.blocks.filter((b) => !dead.has(b.id));
      p.slide.triggers = p.slide.triggers
        .filter((t) => !(t.sourceBlockId && dead.has(t.sourceBlockId)))
        .map((t) => ({ ...t, actions: t.actions.filter((x) => !('blockId' in x && dead.has((x as { blockId: string }).blockId))) }))
        .filter((t) => t.actions.length);
    }
  }
  // A slide that is only ever opened as a lightbox becomes a lightbox slide,
  // so it drops out of Next/Back and the menu as it did in Storyline.
  const slides = pending.map((p) => p.slide);
  slides.forEach((s, i) => { if (i > 0 && lightboxed.has(s.id) && !jumpedTo.has(s.id)) s.lightbox = true; });

  for (const [slide, notes] of perSlide) {
    for (const [msg, count] of notes) warnings.push(`${slide}: ${msg}${count > 1 ? ` (${count} times)` : ''}`);
  }

  return {
    project: {
      id: uid('prj'),
      title: fileName.replace(/\.story$/i, ''),
      slides,
      variables,
      // Graded questions or a result slide: score the course and keep the pass mark.
      completion: { mode: 'allSlides', ...(ctx.nativeIntr.size || ctx.hasResults || ctx.picks.size ? { autoScore: true, passingScore: ctx.passScore ?? 80 } : {}) },
      fonts: [...ctx.fonts]
    },
    warnings
  };
}
