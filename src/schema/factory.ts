import type {
  AnimType, Block, BlockProps, BlockType, Condition, Layer, PlayerSettings, Project, Slide, Trigger, Variable
} from './types';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

// The semantic block tag wrapping a text block's whole content, or '' when the
// content is plain (no single h1-h6/p wrapper).
export function outerTagOf(html: string): '' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  const m = (html || '').trim().match(/^<(h[1-6]|p)>([\s\S]*)<\/\1>$/i);
  return m ? (m[1].toLowerCase() as 'p') : '';
}

// Wrap (or unwrap) a text block's content in a semantic tag.
export function setOuterTag(html: string, tag: string): string {
  const m = (html || '').trim().match(/^<(h[1-6]|p)>([\s\S]*)<\/\1>$/i);
  const inner = m ? m[2] : html;
  return tag ? `<${tag}>${inner}</${tag}>` : inner;
}

// Recursively give a block (and any group children) a fresh id, recording the
// old->new mapping so references elsewhere can be remapped.
function reassignBlockIds(blocks: Block[], map: Map<string, string>): void {
  for (const b of blocks) {
    const nid = uid('blk');
    map.set(b.id, nid);
    b.id = nid;
    if (b.type === 'group') reassignBlockIds((b.props as { blocks: Block[] }).blocks, map);
  }
}

// Clone a slide with entirely fresh ids so it can be inserted more than once
// without id collisions. Remaps trigger/action block references, and clones
// the interaction result-variables the slide's blocks own (their names embed
// the block id) into new variables, remapping condition/action references so
// the copied logic keeps working. Returns the new slide plus any new
// project-level variables to append.
export function cloneSlideFresh(slide: Slide, variables: Variable[]): { slide: Slide; newVariables: Variable[] } {
  const s: Slide = structuredClone(slide);
  s.id = uid('sld');
  const blockMap = new Map<string, string>();
  const layerMap = new Map<string, string>();
  for (const layer of s.layers) {
    const nid = uid('lyr');
    layerMap.set(layer.id, nid);
    layer.id = nid;
    reassignBlockIds(layer.blocks, blockMap);
  }

  // Clone variables whose name embeds one of this slide's (old) block ids -
  // these are the auto-registered interaction results (mc_/fb_/dd_/timer_...).
  const varMap = new Map<string, string>();
  const newVariables: Variable[] = [];
  for (const v of variables) {
    const oldBlockId = [...blockMap.keys()].find((oid) => v.name.includes(oid));
    if (!oldBlockId) continue;
    const nid = uid('var');
    varMap.set(v.id, nid);
    newVariables.push({ ...structuredClone(v), id: nid, name: v.name.split(oldBlockId).join(blockMap.get(oldBlockId)!) });
  }

  const remapCond = (c: Condition) => { if (varMap.has(c.variableId)) c.variableId = varMap.get(c.variableId)!; };
  const remapTrigger = (tr: Trigger) => {
    if (tr.sourceBlockId && blockMap.has(tr.sourceBlockId)) tr.sourceBlockId = blockMap.get(tr.sourceBlockId)!;
    if (tr.watchBlockIds) tr.watchBlockIds = tr.watchBlockIds.map((id) => blockMap.get(id) ?? id);
    tr.conditions?.forEach(remapCond);
    for (const a of tr.actions) {
      const anyA = a as { blockId?: string; layerId?: string; variableId?: string };
      if (anyA.blockId && blockMap.has(anyA.blockId)) anyA.blockId = blockMap.get(anyA.blockId)!;
      if (anyA.layerId && layerMap.has(anyA.layerId)) anyA.layerId = layerMap.get(anyA.layerId)!;
      if (anyA.variableId && varMap.has(anyA.variableId)) anyA.variableId = varMap.get(anyA.variableId)!;
    }
  };
  s.triggers.forEach(remapTrigger);

  return { slide: s, newVariables };
}

export const DEFAULT_BLOCK_SIZE: Record<BlockType, { w: number; h: number }> = {
  text: { w: 420, h: 120 },
  image: { w: 360, h: 240 },
  statement: { w: 640, h: 300 },
  multipleChoice: { w: 480, h: 360 },
  matching: { w: 560, h: 360 },
  button: { w: 200, h: 56 },
  hotspot: { w: 200, h: 160 },
  shape: { w: 280, h: 180 },
  video: { w: 480, h: 270 },
  audio: { w: 360, h: 56 },
  textEntry: { w: 360, h: 56 },
  code: { w: 480, h: 320 },
  group: { w: 400, h: 400 },
  fillBlank: { w: 480, h: 200 },
  progress: { w: 360, h: 48 },
  timer: { w: 200, h: 80 },
  dragDrop: { w: 600, h: 380 },
  tabs: { w: 520, h: 300 }
};

export function defaultPlayerSettings(): PlayerSettings {
  return {
    next: { show: true, label: 'Next' },
    back: { show: true, label: 'Back' },
    submit: { show: false, label: 'Submit' },
    menu: { show: true }
  };
}

export function textEntryVariableName(blockId: string): string {
  return `txt_${blockId}_value`;
}

export function defaultProps(type: BlockType): BlockProps {
  switch (type) {
    case 'text':
      return { html: 'Double-click a text block on the canvas, or edit here.', fontSize: 24, align: 'left' };
    case 'image':
      return { src: '', fit: 'contain', alt: '' };
    case 'statement':
      return {
        heading: 'A statement heading',
        body: 'Supporting body copy for the statement. Learners read this, then continue.'
      };
    case 'button':
      return { label: 'Click me', variant: 'solid', fontSize: 18 };
    case 'hotspot':
      return { showHint: false, tooltip: '' };
    case 'shape':
      return { kind: 'rectangle', fill: '#e8f7f0', borderColor: '#3ddc97', borderWidth: 2, cornerRadius: 8 };
    case 'video':
      return { src: '', controls: true, autoplay: false, loop: false };
    case 'audio':
      return { src: '', controls: true, autoplay: false };
    case 'textEntry':
      return { placeholder: 'Type your answer...', fontSize: 18, multiline: false };
    case 'code':
      return {
        html: '<div class="demo">Hello from a code block</div>',
        css: '.demo { font: 600 20px system-ui; color: #1fa871; }',
        js: "// forge and gsap are in scope.\n// forge.setVariable('name', value); forge.getVariable('name');\n// forge.complete(); forge.onVariableChange(function (name, value) {});\ngsap.from(root.querySelector('.demo'), { y: 24, opacity: 0, duration: 0.6, ease: 'power2.out' });"
      };
    case 'group':
      return { blocks: [] };
    case 'multipleChoice': {
      const a = uid('ch');
      const b = uid('ch');
      return {
        question: 'Which option is correct?',
        choices: [
          { id: a, text: 'This one' },
          { id: b, text: 'Not this one' }
        ],
        correctChoiceIds: [a],
        allowMultiple: false,
        feedbackCorrect: 'Correct. Nicely done.',
        feedbackIncorrect: 'Not quite. Review and try again.'
      };
    }
    case 'matching': {
      return {
        question: 'Match each item to its pair.',
        pairs: [
          { id: uid('pair'), left: 'Sky', right: 'Blue' },
          { id: uid('pair'), left: 'Grass', right: 'Green' },
          { id: uid('pair'), left: 'Sun', right: 'Yellow' }
        ],
        feedbackCorrect: 'All matched correctly!',
        feedbackIncorrect: 'Some matches are off - try again.'
      };
    }
    case 'fillBlank':
      return {
        question: 'The capital of France is ___.',
        correctAnswers: ['Paris'],
        caseSensitive: false,
        fontSize: 20,
        feedbackCorrect: 'Correct!',
        feedbackIncorrect: 'Not quite - try again.'
      };
    case 'progress':
      return { source: 'course', showLabel: true, shape: 'bar' };
    case 'timer':
      return { mode: 'countdown', seconds: 60, fontSize: 32, autoStart: true };
    case 'dragDrop': {
      const t1 = uid('tgt'); const t2 = uid('tgt');
      return {
        question: 'Drag each item to the correct group.',
        targets: [{ id: t1, label: 'Fruit' }, { id: t2, label: 'Vegetable' }],
        items: [
          { id: uid('itm'), text: 'Apple', targetId: t1 },
          { id: uid('itm'), text: 'Carrot', targetId: t2 },
          { id: uid('itm'), text: 'Banana', targetId: t1 }
        ],
        feedbackCorrect: 'All placed correctly!',
        feedbackIncorrect: 'Some items are in the wrong group - try again.'
      };
    }
    case 'tabs':
      return {
        layout: 'tabs',
        fontSize: 16,
        panels: [
          { id: uid('tab'), label: 'Overview', html: '<p>First panel content. Double-click to edit in the panel.</p>' },
          { id: uid('tab'), label: 'Details', html: '<p>Second panel content.</p>' },
          { id: uid('tab'), label: 'Summary', html: '<p>Third panel content.</p>' }
        ]
      };
  }
}

export function fillBlankVariableName(blockId: string): string {
  return `fb_${blockId}_correct`;
}
export function timerDoneVariableName(blockId: string): string {
  return `timer_${blockId}_done`;
}
export function dragDropVariableName(blockId: string): string {
  return `dd_${blockId}_correct`;
}

export function mcVariableName(blockId: string): string {
  return `mc_${blockId}_correct`;
}

export function createBlock(type: BlockType, x: number, y: number): Block {
  const size = DEFAULT_BLOCK_SIZE[type];
  return { id: uid('blk'), type, x, y, w: size.w, h: size.h, props: defaultProps(type) };
}

export function createLayer(name: string, visibleByDefault = false): Layer {
  return { id: uid('lyr'), name, visibleByDefault, blocks: [] };
}

export function createSlide(name: string): Slide {
  const base = createLayer('Base layer', true);
  return { id: uid('sld'), name, width: 1280, height: 720, layers: [base], triggers: [] };
}

export function createProject(title = 'Untitled course'): Project {
  return { id: uid('prj'), title, slides: [createSlide('Slide 1')], variables: [] };
}

// Seed project: a six-slide phishing-awareness mini-course that exercises the
// tool's range - timelines with staggered entrances, motion paths, emphasis
// loops, cue points, hotspots + layers + variables, tabs, a quiz, drag & drop,
// and course completion - so every panel has real content to show.
export function createDemoProject(): Project {
  const project = createProject('Phishing Awareness');

  // Positioned block with a name (timeline rows and trigger pickers read it).
  const blk = (type: BlockType, name: string, x: number, y: number, w: number, h: number): Block => {
    const b = createBlock(type, x, y);
    b.name = name; b.w = w; b.h = h;
    return b;
  };
  const anim = (b: Block, type: AnimType, start: number, duration = 0.6, ease = 'power2.out') => {
    b.timing = { start, animIn: { type, duration, ease } };
  };

  // ---- Slide 1 · Welcome (timeline, staggered entrances, motion, cue) ----
  const s1 = createSlide('Welcome');
  s1.timeline = { duration: 12, autoAdvance: false, cues: [{ id: uid('cue'), name: 'nudge', time: 6 }] };

  const s1Title = blk('text', 'Title', 80, 150, 720, 130);
  s1Title.props = { html: '<b>Phishing Awareness</b>', fontSize: 54, align: 'left', fontWeight: 800 };
  anim(s1Title, 'rise', 0.3, 0.8, 'power3.out');

  const s1Sub = blk('text', 'Subtitle', 80, 280, 640, 90);
  s1Sub.props = {
    html: 'Learn to spot deceptive emails and social-engineering tactics — six short slides, two quick checks.',
    fontSize: 20, align: 'left', color: '#5c6a60'
  };
  anim(s1Sub, 'fade', 0.9);

  const s1Orb = blk('shape', 'Mint orb', 950, 110, 200, 200);
  s1Orb.props = { kind: 'ellipse', fill: '#d9f6ea', borderColor: '#3ddc97', borderWidth: 2, cornerRadius: 8 };
  anim(s1Orb, 'zoom', 1.2, 0.7, 'back.out(1.6)');
  s1Orb.motion = { preset: 'arc', vector: { x: -120, y: 140 }, start: 2, duration: 8, ease: 'power1.inOut', loop: true };

  const s1Shield = blk('shape', 'Shield', 1000, 420, 150, 150);
  s1Shield.props = { kind: 'hexagon', fill: '#3ddc97', borderColor: '#1fa871', borderWidth: 2, cornerRadius: 8 };
  s1Shield.emphasis = 'float';
  anim(s1Shield, 'drop', 1.5, 0.8, 'bounce.out');

  const s1Start = blk('button', 'Start button', 80, 420, 240, 58);
  s1Start.props = { label: 'Start the course →', variant: 'solid', fontSize: 18 };
  anim(s1Start, 'slide', 1.8, 0.6);
  s1.layers[0].blocks.push(s1Title, s1Sub, s1Orb, s1Shield, s1Start);

  // ---- Slide 2 · Spot the red flags (hotspots, layers, variables) ----
  const s2 = createSlide('Spot the red flags');
  const s2Title = blk('text', 'Title', 80, 40, 900, 60);
  s2Title.props = { html: '<b>Spot the three red flags</b> — click anything suspicious.', fontSize: 28, align: 'left' };

  const card = blk('shape', 'Email card', 80, 120, 700, 500);
  card.props = { kind: 'roundedRectangle', fill: '#ffffff', borderColor: '#c9d2ca', borderWidth: 1, cornerRadius: 12 };

  const fromLine = blk('text', 'From line', 110, 150, 640, 36);
  fromLine.props = { html: 'From: <b>security@paypa1-support.com</b>', fontSize: 17, align: 'left' };
  const subjLine = blk('text', 'Subject line', 110, 195, 640, 40);
  subjLine.props = { html: 'Subject: <b>URGENT: your account will be closed in 24 hours!</b>', fontSize: 17, align: 'left' };
  const bodyText = blk('text', 'Email body', 110, 250, 640, 330);
  bodyText.props = {
    html: 'Dear customer,<br><br>We detected unusual activity. You must verify your identity immediately or your account will be permanently suspended.<br><br>Click here to verify: <b>http://paypa1-support.ru/verify</b><br><br>The Security Team',
    fontSize: 16, align: 'left', lineHeight: 1.5
  };

  const flagVars: Variable[] = [];
  const mkFlag = (name: string, hotspot: Block, layerName: string, heading: string, body: string, y: number) => {
    const v: Variable = { id: uid('var'), name, type: 'boolean', defaultValue: false };
    flagVars.push(v);
    project.variables.push(v);
    const layer = createLayer(layerName, false);
    const note = blk('statement', layerName, 820, y, 380, 170);
    note.props = { heading, body };
    layer.blocks.push(note);
    s2.layers.push(layer);
    s2.triggers.push({
      id: uid('trg'), event: 'onClick', sourceBlockId: hotspot.id, conditions: [],
      actions: [{ type: 'setVariable', variableId: v.id, value: true }, { type: 'showLayer', layerId: layer.id }]
    });
  };

  const hs1 = blk('hotspot', 'Sender hotspot', 110, 148, 500, 40);
  hs1.props = { showHint: false, tooltip: 'Look closely at the sender' };
  const hs2 = blk('hotspot', 'Urgency hotspot', 110, 193, 640, 44);
  hs2.props = { showHint: false, tooltip: 'Pressure is a tactic' };
  const hs3 = blk('hotspot', 'Link hotspot', 110, 430, 640, 60);
  hs3.props = { showHint: false, tooltip: 'Check the link' };
  s2.layers[0].blocks.push(s2Title, card, fromLine, subjLine, bodyText, hs1, hs2, hs3);

  mkFlag('flag_sender', hs1, 'Flag: sender', 'Spoofed sender', 'paypa1 is not PayPal - the lowercase L is a digit 1. Always read the domain character by character.', 120);
  mkFlag('flag_urgency', hs2, 'Flag: urgency', 'Manufactured urgency', 'Deadlines and threats push you to act before you think. Real providers do not close accounts in 24 hours.', 300);
  mkFlag('flag_link', hs3, 'Flag: link', 'Mismatched link', 'The link goes to a .ru domain that is not PayPal. Hover before you click - the URL never lies.', 480);

  const s2Done = createLayer('All flags found', false);
  const s2DoneNote = blk('statement', 'All found', 400, 250, 480, 200);
  s2DoneNote.props = { heading: 'All three flags found', body: 'Sender, urgency, link - the classic trio. On to the anatomy of a bad URL.' };
  const s2Next = blk('button', 'Continue button', 400, 470, 200, 52);
  s2Next.props = { label: 'Continue →', variant: 'solid', fontSize: 18 };
  s2Done.blocks.push(s2DoneNote, s2Next);
  s2.layers.push(s2Done);
  s2.triggers.push({
    id: uid('trg'), event: 'onVariableChange',
    conditions: flagVars.map((v) => ({ variableId: v.id, operator: 'eq' as const, value: true })),
    actions: [{ type: 'showLayer', layerId: s2Done.id }]
  });

  // ---- Slide 3 · Anatomy of a URL (tabs, progress) ----
  const s3 = createSlide('Anatomy of a URL');
  s3.timeline = { duration: 8, autoAdvance: false };
  const s3Title = blk('text', 'Title', 80, 40, 900, 60);
  s3Title.props = { html: '<b>Anatomy of a phishing URL</b>', fontSize: 28, align: 'left' };
  anim(s3Title, 'wipe', 0.2, 0.6);

  const s3Url = blk('text', 'Example URL', 80, 120, 1120, 70);
  s3Url.props = {
    html: '<span style="color:#1fa871"><b>https://</b></span><span style="color:#c0392b"><b>paypal.evil-site.ru</b></span><span style="color:#8a8f8b">/secure/verify/login</span>',
    fontSize: 30, align: 'center', fontFamily: 'JetBrains Mono'
  };
  anim(s3Url, 'grow', 0.5, 0.6, 'back.out(1.4)');

  const s3Tabs = blk('tabs', 'URL anatomy tabs', 80, 210, 760, 380);
  s3Tabs.props = {
    layout: 'tabs', fontSize: 16,
    panels: [
      { id: uid('tab'), label: 'Protocol', html: '<p><b>https://</b> only means the connection is encrypted - not that the site is honest. Phishing sites use HTTPS too.</p>' },
      { id: uid('tab'), label: 'Domain', html: '<p>The real owner is the part right before the last dot: in <b>paypal.evil-site.ru</b>, the site is <b>evil-site.ru</b>, not PayPal.</p>' },
      { id: uid('tab'), label: 'Path', html: '<p>Everything after the domain is theater - <b>/secure/verify/login</b> can be typed by anyone. Judge the domain, ignore the path.</p>' }
    ]
  };
  anim(s3Tabs, 'fade', 0.6);

  const s3Progress = blk('progress', 'Course progress', 80, 620, 400, 36);
  s3Progress.props = { source: 'course', showLabel: true, shape: 'bar' };
  const s3Next = blk('button', 'Continue button', 1020, 610, 180, 52);
  s3Next.props = { label: 'Continue →', variant: 'outline', fontSize: 17 };
  s3.layers[0].blocks.push(s3Title, s3Url, s3Tabs, s3Progress, s3Next);

  // ---- Slide 4 · Knowledge check (quiz, variable, success layer) ----
  const s4 = createSlide('Knowledge check');
  const s4Title = blk('text', 'Title', 80, 40, 1000, 60);
  s4Title.props = { html: '<b>Knowledge check</b> — answer to unlock the next slide.', fontSize: 28, align: 'left' };

  const mc = blk('multipleChoice', 'Quiz', 80, 130, 560, 440);
  const c1 = uid('ch'); const c2 = uid('ch'); const c3 = uid('ch');
  mc.props = {
    question: 'An email demands you "verify your account within 24 hours". What do you do?',
    choices: [
      { id: c1, text: 'Go to the site directly - never through the email link' },
      { id: c2, text: 'Click the link, but read the page carefully' },
      { id: c3, text: 'Reply and ask if the email is real' }
    ],
    correctChoiceIds: [c1],
    allowMultiple: false,
    feedbackCorrect: 'Right - type the address yourself or use a bookmark.',
    feedbackIncorrect: 'The link (and the reply address) belong to the attacker.'
  };
  s4.layers[0].blocks.push(s4Title, mc);

  const mcVar: Variable = { id: uid('var'), name: mcVariableName(mc.id), type: 'boolean', defaultValue: false };
  project.variables.push(mcVar);

  const s4Done = createLayer('Correct layer', false);
  const s4Note = blk('statement', 'Correct note', 700, 180, 480, 280);
  s4Note.props = {
    heading: 'Exactly right',
    body: 'A trigger watched the quiz variable and revealed this layer the moment it went true - the same loop you saw on the red-flags slide.'
  };
  const s4Next = blk('button', 'Continue button', 700, 480, 200, 52);
  s4Next.props = { label: 'Continue →', variant: 'solid', fontSize: 18 };
  s4Done.blocks.push(s4Note, s4Next);
  s4.layers.push(s4Done);
  s4.triggers.push({
    id: uid('trg'), event: 'onVariableChange', watchVariableId: mcVar.id,
    conditions: [{ variableId: mcVar.id, operator: 'eq', value: true }],
    actions: [{ type: 'showLayer', layerId: s4Done.id }]
  });

  // ---- Slide 5 · Sort the inbox (drag & drop, variable, layer) ----
  const s5 = createSlide('Sort the inbox');
  const s5Title = blk('text', 'Title', 80, 40, 1000, 60);
  s5Title.props = { html: '<b>Sort the inbox</b> — drag each subject line to the right pile.', fontSize: 28, align: 'left' };

  const dd = blk('dragDrop', 'Inbox sort', 80, 130, 760, 480);
  const tPhish = uid('tgt'); const tSafe = uid('tgt');
  dd.props = {
    question: 'Phishing or safe?',
    targets: [{ id: tPhish, label: 'Phishing' }, { id: tSafe, label: 'Probably safe' }],
    items: [
      { id: uid('itm'), text: 'URGENT: verify your password now', targetId: tPhish },
      { id: uid('itm'), text: 'Minutes from Tuesday’s team meeting', targetId: tSafe },
      { id: uid('itm'), text: 'You’ve won a $500 gift card - claim today', targetId: tPhish },
      { id: uid('itm'), text: 'Invoice #4471 from your printing vendor', targetId: tSafe }
    ],
    feedbackCorrect: 'Clean inbox - all four sorted correctly.',
    feedbackIncorrect: 'One or more are in the wrong pile - look for urgency and prizes.'
  };
  s5.layers[0].blocks.push(s5Title, dd);

  const ddVar: Variable = { id: uid('var'), name: dragDropVariableName(dd.id), type: 'boolean', defaultValue: false };
  project.variables.push(ddVar);

  const s5Done = createLayer('Sorted layer', false);
  const s5Note = blk('statement', 'Sorted note', 880, 180, 320, 240);
  s5Note.props = { heading: 'Inbox secured', body: 'Urgency and too-good-to-be-true offers are the tell. One slide to go.' };
  const s5Next = blk('button', 'Continue button', 880, 440, 200, 52);
  s5Next.props = { label: 'Continue →', variant: 'solid', fontSize: 18 };
  s5Done.blocks.push(s5Note, s5Next);
  s5.layers.push(s5Done);
  s5.triggers.push({
    id: uid('trg'), event: 'onVariableChange', watchVariableId: ddVar.id,
    conditions: [{ variableId: ddVar.id, operator: 'eq', value: true }],
    actions: [{ type: 'showLayer', layerId: s5Done.id }]
  });

  // ---- Slide 6 · Summary (progress ring, completion) ----
  const s6 = createSlide('Summary');
  s6.timeline = { duration: 8, autoAdvance: false };
  const s6Title = blk('text', 'Title', 80, 90, 700, 90);
  s6Title.props = { html: '<b>You’re ready.</b>', fontSize: 44, align: 'left', fontWeight: 800 };
  anim(s6Title, 'rise', 0.3, 0.8, 'power3.out');

  const s6Recap = blk('statement', 'Recap', 80, 210, 620, 280);
  s6Recap.props = {
    heading: 'Three habits to keep',
    body: 'Read sender domains character by character. Treat urgency as a red flag, not a reason to hurry. Never follow the email’s link - navigate there yourself.'
  };
  anim(s6Recap, 'fade', 0.9);

  const s6Ring = blk('progress', 'Progress ring', 860, 200, 220, 220);
  s6Ring.props = { source: 'course', showLabel: true, shape: 'ring' };
  anim(s6Ring, 'zoom', 1.2, 0.7, 'back.out(1.6)');

  const s6Finish = blk('button', 'Finish button', 80, 530, 240, 58);
  s6Finish.props = { label: 'Finish course ✓', variant: 'solid', fontSize: 18 };
  s6Finish.emphasis = 'pulse';
  anim(s6Finish, 'slide', 1.6, 0.6);
  s6.layers[0].blocks.push(s6Title, s6Recap, s6Ring, s6Finish);

  // ---- Cross-slide navigation triggers ----
  project.slides = [s1, s2, s3, s4, s5, s6];
  s1.triggers.push(
    { id: uid('trg'), event: 'onClick', sourceBlockId: s1Start.id, conditions: [], actions: [{ type: 'goToSlide', slideId: s2.id }] },
    { id: uid('trg'), event: 'onCuePoint', cueId: s1.timeline.cues![0].id, conditions: [], actions: [{ type: 'pulseBlock', blockId: s1Start.id, emphasis: 'pulse' }] }
  );
  s2.triggers.push({ id: uid('trg'), event: 'onClick', sourceBlockId: s2Next.id, conditions: [], actions: [{ type: 'goToSlide', slideId: s3.id }] });
  s3.triggers.push({ id: uid('trg'), event: 'onClick', sourceBlockId: s3Next.id, conditions: [], actions: [{ type: 'goToSlide', slideId: s4.id }] });
  s4.triggers.push({ id: uid('trg'), event: 'onClick', sourceBlockId: s4Next.id, conditions: [], actions: [{ type: 'goToSlide', slideId: s5.id }] });
  s5.triggers.push({ id: uid('trg'), event: 'onClick', sourceBlockId: s5Next.id, conditions: [], actions: [{ type: 'goToSlide', slideId: s6.id }] });
  s6.triggers.push({ id: uid('trg'), event: 'onClick', sourceBlockId: s6Finish.id, conditions: [], actions: [{ type: 'completeCourse' }] });

  return project;
}
