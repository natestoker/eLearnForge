// Core data model. Matches the v1 architecture brief with two clarifications:
// - triggers live on Slide (Storyline-style slide triggers)
// - variables live on Project (project-scoped variables)

export type BlockType =
  | 'text' | 'image' | 'statement' | 'multipleChoice'
  | 'button' | 'hotspot' | 'shape' | 'video' | 'audio' | 'textEntry'
  | 'code' | 'matching' | 'group';

export type TextAnim = 'none' | 'fadeIn' | 'typewriter' | 'wordsUp' | 'lettersUp' | 'blurIn';

export interface TextProps {
  html: string;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  color?: string; // absent = stage default
  bold?: boolean;
  fontFamily?: string; // Google font family name; absent = JetBrains Mono
  textAnim?: TextAnim;  // GSAP entrance animation for the text itself
  valign?: 'top' | 'center' | 'bottom'; // vertical alignment in the box
  scroll?: boolean; // show a scrollbar when text overflows the box
}

export interface ImageProps {
  src: string;
  fit: 'cover' | 'contain';
  alt: string;
  // Clip the image to a shape. 'clipKind' uses a preset (star, hexagon...);
  // 'clipPoints' is a custom polygon from the pen tool as "x,y x,y ..." in a
  // 0..100 coordinate space (stretched to the block, PowerPoint-style).
  clipKind?: ShapeKind;
  clipPoints?: string;
}

export interface StatementProps {
  heading: string;
  body: string;
  imageSrc?: string;
}

export interface Choice {
  id: string;
  text: string;
}

export interface MultipleChoiceProps {
  question: string;
  choices: Choice[];
  correctChoiceIds: string[];
  allowMultiple: boolean;
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

export interface MatchPair { id: string; left: string; right: string; }
export interface MatchingProps {
  question: string;
  pairs: MatchPair[];        // left items matched to right items
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

export interface ButtonProps {
  label: string;
  variant: 'solid' | 'outline';
  fontSize: number;
  fill?: string;      // absent = theme mint
  textColor?: string; // absent = auto contrast
}

export interface HotspotProps {
  // Invisible click region at runtime. showHint draws a subtle pulse so
  // learners can discover it; off by default for true hidden hotspots.
  showHint: boolean;
  tooltip: string;
}

export type ShapeKind =
  | 'rectangle' | 'roundedRectangle' | 'ellipse' | 'triangle' | 'rightTriangle'
  | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'arrowRight' | 'arrowLeft'
  | 'arrowUp' | 'arrowDown' | 'chevron' | 'parallelogram' | 'trapezoid';

export interface ShapeProps {
  // Custom polygon points ("x,y x,y ...", 0..100 space). When set, the shape
  // renders this path instead of its preset kind - this is what the pen tool
  // produces.
  points?: string;
  kind: ShapeKind;
  fill: string;
  borderColor: string;
  borderWidth: number;
  cornerRadius: number;
}

export interface VideoProps {
  src: string;
  controls: boolean;
  autoplay: boolean;
  loop: boolean;
}

export interface AudioProps {
  src: string;
  controls: boolean;
  autoplay: boolean;
  label?: string;    // shown on the canvas/timeline (e.g. "Narration")
  hideInPlayer?: boolean; // narration-style: audible but no visible element
}

export interface TextEntryProps {
  // Writes the learner's input into the bound text variable on change.
  placeholder: string;
  fontSize: number;
  multiline: boolean;
}

export interface CodeProps {
  // A Rise-style code block: author HTML/CSS/JS runs inside the published
  // course. JS executes IIFE-wrapped with `forge` (variables/completion
  // API) and `gsap` in scope. Never executed on the authoring canvas.
  html: string;
  css: string;
  js: string;
}

export interface GroupProps {
  blocks: Block[];
}

export type BlockProps =
  | TextProps | ImageProps | StatementProps | MultipleChoiceProps
  | ButtonProps | HotspotProps | ShapeProps | VideoProps | AudioProps
  | MatchingProps
  | TextEntryProps | CodeProps | GroupProps;

export type AnimType =
  | 'none' | 'fade'
  | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight'
  | 'zoom' | 'zoomOut'
  | 'spin' | 'flipX' | 'flipY'
  | 'bounceIn' | 'wipeUp' | 'popRotate';

export interface AnimSpec {
  type: AnimType;
  duration: number; // seconds
  ease: string;     // GSAP ease name, e.g. 'power2.out'
}

export interface BlockTiming {
  start: number;      // seconds into the slide timeline
  end?: number;       // absent = stays until the timeline ends
  animIn?: AnimSpec;
  animOut?: AnimSpec;
}

export interface Block {
  id: string;
  type: BlockType;
  name?: string; // author label; falls back to a humanized type
  x: number;
  y: number;
  w: number;
  h: number;
  props: BlockProps;
  timing?: BlockTiming; // absent = visible for the whole slide (v1/v2 projects)
  // Visual overrides per interactive state (Storyline model). Defined
  // states also switch behavior on: a 'selected' style makes clicks
  // toggle selection; a 'visited' style marks the block after first click.
  stateStyles?: Partial<Record<StyledState, StateStyle>>;
  // Screen-reader exposure. Default (undefined) = auto: exposed only if the
  // block carries text/alt; decorative blocks stay hidden. 'include'/'exclude'
  // force it. accLabel overrides the announced text.
  aria?: 'auto' | 'include' | 'exclude';
  accLabel?: string;
  // Looping attention animation (GSAP), independent of the timeline.
  emphasis?: 'none' | 'pulse' | 'bounce' | 'shake' | 'float' | 'wobble' | 'tada' | 'heartbeat' | 'glow';
  // Grouping: blocks sharing a groupId select and move together. (Deprecated, migrated to type: 'group')
  groupId?: string;
  // Timeline authoring visibility (eye icon toggle)
  editorHidden?: boolean;
  // Starting state of the object (e.g. 'hidden')
  initialState?: BlockState;
}

export interface Layer {
  id: string;
  name: string;
  visibleByDefault: boolean;
  blocks: Block[];
}

export type VariableValue = string | number | boolean;

export interface Variable {
  id: string;
  name: string;
  type: 'boolean' | 'number' | 'string';
  defaultValue: VariableValue;
}

export type TriggerEvent =
  | 'onClick' | 'onSlideLoad' | 'onVariableChange' | 'onTimelineEnd'
  | 'onBlockEnters'        // the block's timeline bar starts (enters the frame)
  | 'onAnimationComplete'  // the block's animate-in finishes
  | 'onStateAll'           // every watched block reached the watched state
  | 'onHover'              // pointer enters the source block
  | 'onDoubleClick'        // source block double-clicked
  | 'onSubmit';            // the player Submit button

// Persistent block states an author or trigger can set. hover/down are
// transient pointer states handled by the player, never stored here.
export type BlockState = 'normal' | 'selected' | 'visited' | 'disabled' | 'hidden';
export type TransientState = 'hover' | 'down';
export type StyledState = Exclude<BlockState, 'normal' | 'hidden'> | TransientState;

export interface StateStyle {
  fill?: string;
  borderColor?: string;
  textColor?: string;
  opacity?: number;
}

export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';

export interface Condition {
  variableId: string;
  // Older v1 projects stored { equals }. The runtime and UI treat a missing
  // operator as 'eq' with `value` falling back to `equals` for migration.
  operator?: ConditionOperator;
  value?: VariableValue;
  equals?: VariableValue;
}

export type Action =
  | { type: 'showLayer'; layerId: string }
  | { type: 'hideLayer'; layerId: string }
  | { type: 'showBlock'; blockId: string }
  | { type: 'hideBlock'; blockId: string }
  | { type: 'goToSlide'; slideId: string }
  | { type: 'setVariable'; variableId: string; value: VariableValue }
  | { type: 'adjustVariable'; variableId: string; delta: number }
  | { type: 'completeCourse' }
  | { type: 'setScore'; score: number }
  | { type: 'setState'; blockId: string; state: BlockState }
  | { type: 'setPlayerButton'; button: 'next' | 'back' | 'submit'; enabled: boolean }
  | { type: 'playAudio'; blockId: string }
  | { type: 'pauseAudio'; blockId: string }
  | { type: 'pulseBlock'; blockId: string; emphasis: 'pulse' | 'bounce' | 'shake' | 'float' }
  | { type: 'pauseTimeline' }
  | { type: 'resumeTimeline' }
  | { type: 'seekTimeline'; seconds: number };

export type ActionType = Action['type'];

export interface Trigger {
  id: string;
  event: TriggerEvent;
  sourceBlockId?: string; // for onClick
  watchVariableId?: string; // for onVariableChange; undefined = any variable
  watchBlockIds?: string[]; // onStateAll
  watchState?: BlockState;  // onStateAll
  conditions: Condition[];
  actions: Action[];
}

export interface Slide {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[]; // layers[0] is always the base layer
  triggers: Trigger[];
  timeline?: SlideTimeline; // absent = static slide, no clock or controls
  notes?: string;           // speaker notes (PPTX import lands here)
}

export interface SlideTimeline {
  duration: number;       // seconds; ignored when narration drives the clock
  narrationSrc?: string;  // slide audio; its length becomes the duration
  autoAdvance: boolean;   // go to the next slide when the timeline ends
  tts?: TtsSettings;      // narrate slide.notes with the Web Speech API
}

export interface TtsSettings {
  voiceName?: string; // browser voice; absent = system default
  rate: number;       // 0.5 - 2.0
}

export interface PlayerButton {
  show: boolean;
  label: string;
}

export interface PlayerSettings {
  next: PlayerButton;
  back: PlayerButton;
  submit: PlayerButton;
  menu: { show: boolean; locked?: boolean }; // locked = view-only (no jumping)
  voiceControls: boolean; // learner-facing voice/rate controls for TTS slides
  // Chrome styling.
  accent?: string;        // player accent (buttons, progress) - defaults to theme
  chrome?: 'dark' | 'light' | 'minimal';
  buttonShape?: 'rounded' | 'pill' | 'square';
  buttonStyle?: 'solid' | 'outline';
  progressBar?: boolean;  // show a course progress bar in the chrome
}

export type CompletionMode = 'allSlides' | 'explicit';

export interface CompletionSettings {
  // allSlides: complete when every slide has been viewed.
  // explicit: complete only via a completeCourse trigger action.
  mode: CompletionMode;
}

export interface Project {
  id: string;
  title: string;
  slides: Slide[];
  variables: Variable[];
  completion?: CompletionSettings; // absent in v1 projects -> allSlides
  theme?: { accent: string };      // default color for new shapes/buttons
  player?: PlayerSettings;
  fonts?: string[]; // google font families used (for publish <link>s)
  // Fonts embedded from an imported PowerPoint: family name + a data-URL
  // font file, emitted as @font-face so the deck's own typeface renders even
  // if it isn't a Google font.
  embeddedFonts?: { family: string; dataUrl: string; weight?: number; italic?: boolean }[];
  slideTransition?: 'none' | 'fade' | 'slide' | 'zoom'; // GSAP between slides
}
