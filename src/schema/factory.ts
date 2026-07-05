import type {
  Block, BlockProps, BlockType, Layer, PlayerSettings, Project, Slide, Variable
} from './types';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
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
  code: { w: 480, h: 320 }
};

export function defaultPlayerSettings(): PlayerSettings {
  return {
    next: { show: true, label: 'Next' },
    back: { show: true, label: 'Back' },
    submit: { show: false, label: 'Submit' },
    menu: { show: true },
    voiceControls: true
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
  }
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

// Seed project: demonstrates the full loop (blocks -> variable -> trigger -> layer)
// so the tool proves itself the moment it opens.
export function createDemoProject(): Project {
  const project = createProject('eLearnForge demo');
  const slide = project.slides[0];
  slide.name = 'Trigger demo';

  const title = createBlock('text', 80, 48);
  title.w = 1120; title.h = 90;
  title.props = {
    html: '<b>Welcome to eLearnForge</b> — answer the question to reveal the hidden layer.',
    fontSize: 30, align: 'left'
  };

  const mc = createBlock('multipleChoice', 80, 180);
  mc.w = 560; mc.h = 420;
  const c1 = uid('ch'); const c2 = uid('ch'); const c3 = uid('ch');
  mc.props = {
    question: 'What shows and hides a layer at runtime?',
    choices: [
      { id: c1, text: 'A trigger' },
      { id: c2, text: 'A template' },
      { id: c3, text: 'A timeline' }
    ],
    correctChoiceIds: [c1],
    allowMultiple: false,
    feedbackCorrect: 'Right — a trigger just fired one for you.',
    feedbackIncorrect: 'Not quite. Think Storyline.'
  };
  slide.layers[0].blocks.push(title, mc);

  const mcVar: Variable = {
    id: uid('var'),
    name: mcVariableName(mc.id),
    type: 'boolean',
    defaultValue: false
  };
  project.variables.push(mcVar);

  const successLayer = createLayer('Success layer', false);
  const statement = createBlock('statement', 700, 200);
  statement.w = 500; statement.h = 340;
  statement.props = {
    heading: 'This layer was hidden',
    body: 'A trigger watched the question variable and showed this layer when it became true. That is the whole authoring loop: blocks, variables, triggers, layers.'
  };
  successLayer.blocks.push(statement);
  slide.layers.push(successLayer);

  slide.triggers.push({
    id: uid('trg'),
    event: 'onVariableChange',
    watchVariableId: mcVar.id,
    conditions: [{ variableId: mcVar.id, equals: true }],
    actions: [{ type: 'showLayer', layerId: successLayer.id }]
  });

  return project;
}
