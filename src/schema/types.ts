// Core data model. Matches the v1 architecture brief with two clarifications:
// - triggers live on Slide (Storyline-style slide triggers)
// - variables live on Project (project-scoped variables)

export type BlockType =
  | 'text' | 'image' | 'statement' | 'multipleChoice'
  | 'button' | 'hotspot' | 'shape' | 'video' | 'audio' | 'textEntry'
  | 'code' | 'matching' | 'group'
  | 'fillBlank' | 'progress' | 'timer' | 'dragDrop' | 'tabs'
  | 'flashcards' | 'sequence' | 'slider' | 'checklist' | 'varDisplay'
  | 'labeledGraphic' | 'scenario';

export type TextAnim = 'none' | 'fadeIn' | 'typewriter' | 'wordsUp' | 'lettersUp' | 'blurIn';

export interface TextProps {
  html: string;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  color?: string; // absent = stage default
  bold?: boolean; // legacy; superseded by fontWeight (bold = 700)
  fontWeight?: number; // 100..900; absent = 400 (or 700 if bold is set)
  fontFamily?: string; // Google font family name; absent = JetBrains Mono
  textAnim?: TextAnim;  // GSAP entrance animation for the text itself
  valign?: 'top' | 'center' | 'bottom'; // vertical alignment in the box
  scroll?: boolean; // show a scrollbar when text overflows the box
  // Line height multiplier. Default 1.35; PPTX import writes the deck's
  // real spacing (single spacing = 1.2) so layouts match PowerPoint.
  lineHeight?: number;
  letterSpacing?: number; // px; 0 = normal
  // Internal margins (space between the box edge and the text), in px, per
  // side. Absent sides = 0. PowerPoint calls this the internal text margin.
  inset?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface ImageProps {
  src: string;
  fit: 'cover' | 'contain';
  alt: string;
  // Clip the image to a shape. 'clipKind' uses a preset (star, hexagon...);
  // 'clipNodes' is a custom vector path from the pen tool (same editing
  // engine as custom shapes). 'clipPoints' is the legacy pen polygon
  // ("x,y x,y ...", 0..100 space) kept for old projects.
  clipKind?: ShapeKind;
  clipNodes?: PathNode[];
  clipPoints?: string;
}

// One anchor of an editable vector path (0..100 space, stretched to the
// block like preset geometry). h1 is the incoming Bezier handle, h2 the
// outgoing one; both absent = a straight corner point. smooth keeps the
// handles mirrored while editing (Illustrator's smooth/corner distinction).
export interface PathNode {
  x: number;
  y: number;
  h1?: { x: number; y: number };
  h2?: { x: number; y: number };
  smooth?: boolean;
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
  | 'arrowUp' | 'arrowDown' | 'chevron' | 'parallelogram' | 'trapezoid'
  | 'octagon' | 'plus' | 'heart' | 'lightningBolt' | 'smileyFace' | 'cloud'
  | 'sun' | 'moon' | 'heptagon' | 'decagon' | 'dodecagon' | 'database'
  | 'flowchartDocument' | 'flowchartTerminator' | 'explosion' | 'scrollHorizontal'
  | 'calloutRectangle' | 'calloutRoundRect' | 'calloutEllipse' | 'leftRightArrow'
  | 'upDownArrow' | 'quadArrow' | 'stripedRightArrow' | 'notchedRightArrow';

export interface ShapeProps {
  // Editable vector path from the pen tool (anchors + Bezier handles).
  // When set, the shape renders this path instead of its preset kind.
  nodes?: PathNode[];
  // Legacy pen polygon ("x,y x,y ...", 0..100 space) from before the vector
  // engine; renders as straight segments (or a Catmull-Rom curve when
  // smooth). Superseded by nodes; migrated the first time it's re-edited.
  points?: string;
  smooth?: boolean;
  // Callout kinds only: where the tail points, in the same 0..100 space
  // (values outside 0..100 reach beyond the block, PowerPoint-style).
  // Absent = the classic default tail.
  tail?: { x: number; y: number };
  kind: ShapeKind;
  fill: string;
  borderColor: string;
  borderWidth: number;
  cornerRadius: number;
  // Legacy soft shadow flag (pre-v6.3). Migrated to Block.shadow on read.
  shadow?: boolean;
  isLine?: boolean;
  // Legacy line arrows (v6 and earlier): a fixed triangle at start/end.
  // Superseded by lineStart/lineEnd; the renderer migrates on the fly.
  arrow?: 'none' | 'start' | 'end' | 'both';
  // PowerPoint-style line ends: independent head/tail type and size.
  // lineStart draws at the line's first point, lineEnd at its second.
  lineStart?: LineEnd;
  lineEnd?: LineEnd;
}

export type LineEndType = 'none' | 'triangle' | 'stealth' | 'open' | 'oval' | 'diamond';
export type LineEndSize = 'sm' | 'md' | 'lg';
export interface LineEnd {
  type: LineEndType;
  size?: LineEndSize; // default md; scales with the line width like PowerPoint
}

export interface VideoProps {
  src: string;
  controls: boolean;
  autoplay: boolean;
  loop: boolean;
  // Still frame shown before playback (data URL or URL).
  poster?: string;
  // Raw WebVTT caption text. Stored as text (not a data: URL) so it stays
  // serializable in the project and dodges the browser's CORS restriction on
  // <track> data URLs - the renderer wraps it in a Blob URL on the fly.
  captionsVtt?: string;
  captionsLabel?: string; // track label, e.g. "English"
  captionsLang?: string;  // BCP-47, e.g. "en"
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

// Fill-in-the-blank: a prompt (use ___ to show the blank) and an input the
// learner types into; scored against acceptable answers on Check. Sets
// fb_{blockId}_correct like MC's variable.
export interface FillBlankProps {
  question: string;
  correctAnswers: string[]; // any match passes
  caseSensitive?: boolean;
  fontSize: number;
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

// Progress widget: a bar or ring driven by course progress (viewed slides)
// or a 0..100 number variable.
export interface ProgressProps {
  source: 'course' | 'variable';
  variableId?: string;
  color?: string;      // absent = player accent
  showLabel: boolean;
  shape: 'bar' | 'ring';
}

// Timer widget: counts up, or down from `seconds`. A countdown sets
// timer_{blockId}_done = true at zero so triggers can react.
export interface TimerProps {
  mode: 'countup' | 'countdown';
  seconds: number;
  fontSize: number;
  autoStart: boolean;
  color?: string;
}

// Drag-and-drop: draggable items each belong to a target (drop zone).
// Learners drag items into zones; scored on Check. Sets dd_{blockId}_correct.
export interface DragDropItem { id: string; text: string; targetId: string }
export interface DragDropTarget { id: string; label: string }
export interface DragDropProps {
  question: string;
  items: DragDropItem[];
  targets: DragDropTarget[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

// Tabs / accordion: a set of labeled panels of HTML content. 'tabs' shows a
// tab strip with one panel visible; 'accordion' stacks expandable sections.
export interface TabPanel { id: string; label: string; html: string }
export interface TabsProps {
  layout: 'tabs' | 'accordion';
  panels: TabPanel[];
  accent?: string;
  fontSize: number;
}

// Flashcards: a grid of flip cards (Rise-style). Flipping every card once
// sets fc_{blockId}_done so triggers can gate progress on it.
export interface Flashcard { id: string; front: string; back: string }
export interface FlashcardsProps {
  cards: Flashcard[];
  columns: number; // grid columns; rows follow from the card count
  accent?: string; // card back color; absent = theme mint
}

// Sequence: put the steps in order. Items are STORED in the correct order;
// the runtime shuffles them for the learner. Scored on Check into
// seq_{blockId}_correct.
export interface SequenceItem { id: string; text: string }
export interface SequenceProps {
  question: string;
  items: SequenceItem[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

// Slider: a labeled range input. Every change writes the number variable
// slider_{blockId}_value, so triggers can react with gt/lt/between.
export interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  showValue: boolean;
}

// Checklist: tick items off; all checked sets cl_{blockId}_done (and
// unchecking clears it), the classic "confirm the steps" gate.
export interface ChecklistItem { id: string; text: string }
export interface ChecklistProps {
  title: string;
  items: ChecklistItem[];
}

// Labeled graphic (Rise-style): an image with numbered marker pins; clicking
// a pin opens a popup card. Opening every pin once sets lg_{blockId}_done.
export interface GraphicMarker {
  id: string;
  x: number; // percent 0..100 of block width
  y: number; // percent 0..100 of block height
  title: string;
  body: string;
}
export interface LabeledGraphicProps {
  src: string;             // background image; empty = neutral surface
  fit: 'cover' | 'contain';
  markers: GraphicMarker[];
}

// Branching scenario: passages of dialogue/story, each with choice buttons
// jumping to another passage (or ending). Reaching an ending sets
// sc_{blockId}_done; the chosen path is reported for tracking.
export interface ScenarioChoice { id: string; label: string; targetId: string } // targetId '' = end
export interface ScenarioPassage {
  id: string;
  speaker?: string;
  text: string;
  choices: ScenarioChoice[]; // empty = ending passage
}
export interface ScenarioProps {
  passages: ScenarioPassage[]; // passages[0] is the start
}

// Score / value display: a stat tile showing one live reference - a project
// variable by name or a built-in (Score, ProgressPercent, SlideNumber...).
// The player re-renders on every runtime change, so it tracks live.
export interface VarDisplayProps {
  reference: string;   // variable name or built-in reference name
  label: string;       // caption under the value; empty = value only
  prefix?: string;     // e.g. "$"
  suffix?: string;     // e.g. "%", "pts"
  fontSize: number;    // value size; the caption scales from it
  color?: string;      // value color; absent = theme mint
  align: 'left' | 'center' | 'right';
  tile: boolean;       // true = card with border; false = bare text
}

export type BlockProps =
  | TextProps | ImageProps | StatementProps | MultipleChoiceProps
  | ButtonProps | HotspotProps | ShapeProps | VideoProps | AudioProps
  | MatchingProps
  | TextEntryProps | CodeProps | GroupProps
  | FillBlankProps | ProgressProps | TimerProps | DragDropProps | TabsProps
  | FlashcardsProps | SequenceProps | SliderProps | ChecklistProps | VarDisplayProps
  | LabeledGraphicProps | ScenarioProps;

// One entry per EFFECT; direction is an option, not a separate animation.
// Legacy per-direction values (slideUp, wipeUp, flipX...) still parse -
// normalizeAnimSpec() in engine/timeline maps them onto these.
export type AnimType =
  | 'none' | 'fade'
  | 'slide'   // directional slide + fade (direction, distance)
  | 'rise'    // PowerPoint-style Rise: long decelerating travel (direction up/down, distance)
  | 'wipe'    // directional reveal (direction)
  | 'flip'    // 3D flip (direction picks the axis: up/down = X, left/right = Y)
  | 'zoom' | 'zoomOut'
  | 'blur'    // resolves from a blur (distance = max blur radius in px)
  | 'spin' | 'bounceIn' | 'popRotate'
  | 'grow'     // scales up from nothing
  | 'stretch'  // unfolds horizontally
  | 'collapse' // unfolds vertically
  | 'drop'     // falls in from above (distance; pair with a bounce ease)
  | 'swivel'   // full Y-axis turn while fading in
  | 'whipIn'   // fast angled swing-in (direction left/right, distance)
  | 'flyCorner' // slides in diagonally from a corner (direction = the corner)
  | 'roll';    // rolls in from the side with a spin (direction left/right)

// Legacy stored values from projects saved before the consolidation.
export type LegacyAnimType =
  | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight'
  | 'wipeUp' | 'flipX' | 'flipY';

export type AnimDirection =
  | 'up' | 'down' | 'left' | 'right'
  | 'upLeft' | 'upRight' | 'downLeft' | 'downRight'; // corners (fly-in)

export interface AnimSpec {
  type: AnimType | LegacyAnimType;
  duration: number; // seconds
  ease: string;     // GSAP ease name, e.g. 'power2.out'
  direction?: AnimDirection; // slide/rise/wipe/flip; each type has a default
  distance?: number;         // px travel for slide/rise (defaults per type)
}

export interface BlockTiming {
  start: number;      // seconds into the slide timeline
  end?: number;       // absent = stays until the timeline ends
  animIn?: AnimSpec;
  animOut?: AnimSpec;
  // Additional entrance/exit effects that play TOGETHER with animIn/animOut
  // (e.g. fade + spin + zoom). Each has its own duration/ease, all anchored to
  // the block's start (entrances) or end (exits). Composited by the timeline.
  animInStack?: AnimSpec[];
  animOutStack?: AnimSpec[];
}

// A block travelling along a curve over the slide timeline. Stored as a
// preset + one control vector (px offset of the draggable handle from the
// block's authored position); the polyline is generated on demand.
export interface MotionPath {
  preset: 'line' | 'arc' | 'circle';
  vector: { x: number; y: number };
  start: number;    // seconds into the slide timeline
  duration: number; // seconds to traverse the path
  ease: string;
  loop?: boolean;
  // When true the block does NOT travel automatically on the timeline; it
  // waits at its start position until a `playMotion` trigger fires. Lets an
  // author drive movement from a click/variable instead of the clock.
  trigger?: boolean;
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
  // Audio attached to the block (an uploaded file or a Kokoro bake). Plays
  // through the same file-based pipeline as audio blocks: on a timeline it
  // follows the slide clock from the block's start; otherwise it plays when
  // the block appears. playAudio/pauseAudio triggers target it too.
  audio?: { src: string };
  // Looping attention animation (GSAP), independent of the timeline.
  emphasis?: 'none' | 'pulse' | 'bounce' | 'shake' | 'float' | 'wobble' | 'tada' | 'heartbeat' | 'glow';
  // Grouping: blocks sharing a groupId select and move together. (Deprecated, migrated to type: 'group')
  groupId?: string;
  // Timeline authoring visibility (eye icon toggle)
  editorHidden?: boolean;
  // Authoring lock (timeline padlock): a locked block can be selected and
  // inspected but not moved, resized, nudged, deleted, or retimed until
  // unlocked. Editor-only concept; the player ignores it.
  locked?: boolean;
  // Rotation in degrees, clockwise, around the block center. Rendered in
  // the editor and the player alike.
  rotation?: number;
  // PowerPoint-style shadow (outer or inner). Replaces the old boolean
  // ShapeProps.shadow, which migrates to a default spec on read.
  shadow?: ShadowSpec;
  // PowerPoint-style reflection: a mirrored, fading copy below the block.
  reflection?: ReflectionSpec;
  // Travels along a curve over the slide timeline (see MotionPath).
  motion?: MotionPath;
}

// A mirrored reflection hugging one edge of the block (CSS -webkit-box-reflect).
export interface ReflectionSpec {
  opacity: number;  // 0..1 strength nearest the block
  size: number;     // 0..1 fraction of the reflection that is visible before fading out
  distance: number; // px gap between the block and its reflection
  // Which edge the mirrored copy attaches to. Absent = 'below' (the classic
  // PowerPoint/dock reflection), for projects saved before this was added.
  direction?: 'below' | 'above' | 'left' | 'right';
}

// PowerPoint shadow model: dir/dist polar offset, blur, color+alpha.
// angle is degrees clockwise from +x (PowerPoint's dir / 60000).
export interface ShadowSpec {
  inner?: boolean;   // inner shadow instead of the default outer
  color: string;     // hex
  opacity: number;   // 0..1
  blur: number;      // px
  distance: number;  // px
  angle: number;     // deg
  spread?: number;   // px, used where box-shadow renders (rect bodies)
}

export interface Layer {
  id: string;
  name: string;
  visibleByDefault: boolean;
  // Authoring lock for the whole layer (see Block.locked).
  locked?: boolean;
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
  | 'onMouseLeave'         // pointer leaves the source block
  | 'onDoubleClick'        // source block double-clicked
  | 'onCuePoint'           // the timeline playhead crosses a named cue
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
  // Looping attention animation that runs while this state is active (e.g. a
  // button that pulses on hover). Overrides the block's base emphasis for the
  // duration of the state; clears back to it when the state ends.
  emphasis?: 'none' | 'pulse' | 'bounce' | 'shake' | 'float' | 'wobble' | 'tada' | 'heartbeat' | 'glow';
}

export type ConditionOperator =
  | 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'
  | 'notContains' | 'startsWith' | 'endsWith' | 'between' | 'isEmpty' | 'notEmpty';

export interface Condition {
  variableId: string;
  // Older v1 projects stored { equals }. The runtime and UI treat a missing
  // operator as 'eq' with `value` falling back to `equals` for migration.
  operator?: ConditionOperator;
  value?: VariableValue;
  value2?: VariableValue; // upper bound for 'between'
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
  | { type: 'playMotion'; blockId: string }
  | { type: 'pauseTimeline' }
  | { type: 'resumeTimeline' }
  | { type: 'seekTimeline'; seconds: number }
  | { type: 'openUrl'; url: string }
  | { type: 'toggleBlock'; blockId: string }
  | { type: 'restartTimeline' };

export type ActionType = Action['type'];

export interface Trigger {
  id: string;
  event: TriggerEvent;
  sourceBlockId?: string; // for onClick
  watchVariableId?: string; // for onVariableChange; undefined = any variable
  watchBlockIds?: string[]; // onStateAll
  watchState?: BlockState;  // onStateAll
  cueId?: string;           // onCuePoint
  conditions: Condition[];
  // How the conditions combine. 'and' (default) requires all; 'or' requires
  // any one. Absent = 'and' for older projects.
  conditionLogic?: 'and' | 'or';
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
  // Author-only alignment guides (Illustrator/PowerPoint style): a fixed
  // line at `pos` (slide px) that blocks snap to while dragging/resizing.
  // Never rendered in the player.
  guides?: GuideLine[];
  // Per-slide override of the GSAP entrance transition (Project.slideTransition
  // is the course-wide default). Absent = inherit the course default; this
  // is the general pattern for slide-level settings that can override a
  // global one without needing to be set everywhere.
  transition?: SlideTransition;
  // Per-slide override of the global player nav buttons (PlayerSettings.next /
  // back / submit). Absent per button = inherit the global setting. 'hide'
  // removes the button on this slide, 'disable' shows it greyed out, 'show'
  // forces it visible even when hidden globally. This is how you e.g. block
  // Next on a gate slide without touching the course-wide chrome.
  nav?: SlideNavOverride;
  // Slide backdrop behind all layers. Absent = the theme's neutral surface.
  // Lets an author set a colour/gradient/image without dropping a full-bleed
  // graphic on the base layer.
  background?: SlideBackground;
}

export interface SlideBackground {
  type: 'color' | 'gradient' | 'image';
  color?: string;                          // type 'color'
  from?: string; to?: string; angle?: number; // type 'gradient' (deg)
  src?: string; fit?: 'cover' | 'contain' | 'tile'; // type 'image'
}

export type NavOverride = 'show' | 'hide' | 'disable';
export interface SlideNavOverride {
  next?: NavOverride;
  back?: NavOverride;
  submit?: NavOverride;
}

// Sentinel target meaning "the object this trigger fires on" (its
// sourceBlockId) - the Storyline "this object" convenience. Block ids are
// always "blk_..." so this string never collides with a real one. The runtime
// resolves it to the trigger's source when the action runs.
export const SELF_TARGET = 'self';

export type SlideTransition =
  | 'none' | 'fade' | 'slide' | 'slideLeft' | 'slideRight' | 'slideUp'
  | 'zoom' | 'zoomOut' | 'flip' | 'pageFlip';

export interface GuideLine {
  id: string;
  axis: 'h' | 'v'; // 'h' = horizontal line at y=pos; 'v' = vertical line at x=pos
  pos: number;
}

export interface CuePoint {
  id: string;
  name: string;
  time: number; // seconds into the slide timeline
}

export interface SlideTimeline {
  duration: number;       // seconds; ignored when narration drives the clock
  narrationSrc?: string;  // slide audio; its length becomes the duration
  autoAdvance: boolean;   // go to the next slide when the timeline ends
  // Named markers on the timeline for planning; an onCuePoint trigger fires
  // when the playhead crosses one (forward only), Storyline-style.
  cues?: CuePoint[];
  // WebVTT captions shown over the stage during playback, synced to the slide
  // clock. Auto-generated when narration is baked from the speaker notes, or
  // pasted/edited by the author.
  captionsVtt?: string;
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
  // Where Back/Next/Submit sit in the bottom bar. Default right.
  navPosition?: 'left' | 'right';
  // Course title placement. 'bottom' (default) in the chrome bar HUD;
  // 'top' shows a title bar above the stage; 'hidden' removes it.
  titlePosition?: 'bottom' | 'top' | 'hidden';
  // Hover effect on the nav buttons (Back/Next/Submit).
  buttonHover?: 'none' | 'lift' | 'glow' | 'scale' | 'brightness';
  // Looping attention animation on the ENABLED accent buttons (Next/Submit).
  buttonEmphasis?: 'none' | 'pulse' | 'glow';
  // When the emphasis above actually turns on. Absent/'always' = on the
  // whole time the button is enabled (today's behavior). 'timelineEnd' waits
  // for the current slide's timeline to finish playing (slides with no
  // timeline count as already "ended"). 'variable' waits for a condition on
  // one course variable.
  buttonEmphasisTrigger?: 'always' | 'timelineEnd' | 'variable';
  buttonEmphasisCondition?: Condition; // used when buttonEmphasisTrigger === 'variable'
  // Chrome styling.
  accent?: string;        // player accent (buttons, progress) - defaults to theme
  chrome?: 'dark' | 'light' | 'minimal';
  buttonShape?: 'rounded' | 'pill' | 'square';
  buttonStyle?: 'solid' | 'outline';
  progressBar?: boolean;  // show a course progress bar in the chrome
  // Show the CC (closed-captions) toggle in the player controls when the
  // current slide has captions. Absent = true (shown whenever captions
  // exist); set false to hide the button and always show captions on, or to
  // keep the transport bar minimal.
  captionsButton?: boolean;
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
  // GSAP transition when entering a slide - the course-wide default. A
  // slide's own `transition` (Slide.transition) overrides this if set.
  slideTransition?: SlideTransition;
  // Reusable slide layouts saved by the author. Inserting one clones the
  // stored slide with fresh ids. Travels inside the project file.
  templates?: SlideTemplate[];
  // Course-level handouts learners can download, shown in the player's
  // Resources panel.
  resources?: ResourceItem[];
  // Course-level glossary terms, shown in the player's Glossary panel.
  glossary?: GlossaryTerm[];
  // Reusable text styles (like paragraph/heading styles): capture a text
  // block's look once and apply it to others. Travels in the project file.
  textStyles?: TextStyle[];
}

// A named, reusable text style. Applying it copies these props onto a text
// block and wraps its content in `tag`.
export interface TextStyle {
  id: string;
  name: string;
  tag?: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  fontFamily?: string;
  fontSize: number;
  color?: string;
  fontWeight?: number;
  bold?: boolean;
  align: 'left' | 'center' | 'right';
  valign?: 'top' | 'center' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  inset?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface SlideTemplate {
  id: string;
  name: string;
  slide: Slide; // snapshot; cloned with new ids on insert
}

export interface ResourceItem {
  id: string;
  title: string;
  url: string;       // external URL or an embedded data: URL
  description?: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
}
