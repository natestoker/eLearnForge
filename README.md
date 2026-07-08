# eLearnForge v1

Hybrid Rise/Storyline browser authoring tool. React + TypeScript + Vite + Zustand.

## Run
    npm install
    npm run dev        # editor at localhost:5173, player at /player.html
    npm run build      # production build to dist/ (both entries)

The build produces exactly two self-contained files in dist/:
index.html (editor) and player.html (runtime). All JS and CSS are inlined
via vite-plugin-singlefile, so there are no module fetches, no MIME-type
dependence on the server, and no assets folder. Drop them in any folder on
any host, or open them straight from disk via file://. The two builds run
back to back, switched by the FORGE_ENTRY env var (see package.json).

## Architecture decisions (resolved open questions)
1. **Undo/redo** - snapshot history behind a single `record()` gate in the store.
   Gestures (drag, resize, arrow nudge) record once at the start, then mutate
   silently, so a whole drag is one undo step. Cap 100 snapshots.
2. **Property panels** - hand-built per block, sharing field primitives from
   `src/editor/fields.tsx`. Schema-driven forms stay a v2 door: the
   `BlockDefinition` registry already isolates each block's three renderers.
3. **Persistence** - IndexedDB autosave (debounced 800ms, single `current`
   key) plus explicit JSON export/import for portability and versioning.

## Schema clarifications
- Triggers live on the **Slide**. Variables live on the **Project**.
- `layers[0]` is the base layer: always visible, cannot be deleted.
- MC blocks auto-create a boolean variable `mc_{blockId}_correct` on insert.

## Key paths
- `src/schema/`      types + factories + demo project
- `src/state/`       Zustand project store, IndexedDB persistence, UI store
- `src/engine/`      runtime trigger engine (framework-free, depth cap 25)
- `src/blocks/`      one folder per block: Canvas / Properties / Runtime
- `src/editor/`      canvas, panels, toolbar, app shell
- `src/runtime/`     standalone player (player.html entry)

## Layer hit-testing note
Layer wrappers are transparent full-stage divs stacked in order. They are
`pointer-events: none` with blocks re-enabling `pointer-events: auto`,
otherwise the topmost layer masks every block underneath it. This applies
to both the editor stage and the runtime player. Keep this invariant if
you add new layer chrome.


# v2

## Publish targets
The Publish button in the toolbar packages the current project client-side
(no server involved):
- Web: one self-contained HTML file. Resumes via localStorage.
- SCORM 1.2: zip with imsmanifest.xml. Reports lesson_location per slide,
  cmi.interactions for question answers, score, lesson_status, and resumes
  via suspend_data (kept under the 4096-char cap: position + non-default
  variables only). Verified against a scripted LMS harness and the
  natestoker.com scorm-viewer.
- SCORM 2004 4th Edition: same reporting with 2004 vocabulary
  (completion_status/success_status, scaled score, cmi.location).
- xAPI / Tin Can: zip with tincan.xml. Sends initialized / experienced /
  answered / scored / completed statements to the LRS given in the launch
  query string (endpoint, auth, actor, activity_id, registration).
- Storyline web object: zip with index.html, storyline-bridge.js (paste
  into an Execute JavaScript trigger; pushes results into Storyline
  variables via SetVar), and a README with setup steps.

## Tracking architecture
src/tracking/adapter.ts defines the semantic event interface
(slideViewed, interaction, scored, completed). The runtime engine emits
those and knows nothing about protocols; each target is one adapter file.
Events fired before the adapter subscribes (the first slide enters during
construction) are buffered and flushed, and the adapter initializes before
subscribing so a baseline 'incomplete' can never overwrite a buffered
'completed'.

## Completion model
project.completion.mode: 'allSlides' (default; complete when every slide
has been viewed) or 'explicit' (only the Complete course trigger action
completes). Set it in the Publish dialog.

## New in the trigger engine
Condition operators: =, not =, >, <, >=, <=, contains (offered per
variable type). New actions: Adjust variable by, Complete course,
Set score. Legacy v1 conditions ({ equals }) still evaluate.

## New blocks
Button, Hotspot (invisible click region, optional pulse hint), Shape,
Video, Audio, Text entry (writes txt_{blockId}_value as the learner
types). Media uploads embed as data URLs and travel inside the published
file; keep them small or host and paste a URL.

## Runtime hit-testing invariants
Two rules keep stacked content clickable; preserve both:
1. Layer wrappers are pointer-events none; blocks re-enable auto (editor
   and player).
2. Player block wrappers are pointer-events none unless the block is a
   click-trigger source; native controls (button/input/video/...) inside
   any block re-enable themselves.

## Build
Player builds first, then the editor bakes dist/player.html in as a
string (virtual:player-html) so publishing works entirely offline from
the single editor file. Publishing from npm run dev is disabled; publish
from the built dist/index.html.


# v3

## Timeline + GSAP animation
Add a timeline to a slide in the slide properties (select nothing on the
canvas). The slide gains a clock, play/pause/seek controls, and a
Storyline-style bar strip under the canvas (drag bars to move, drag the
right edge to trim; one undo step per gesture). Blocks get Timing in
Properties: start/end plus animate-in/out presets (fade, slide, zoom)
with GSAP eases. Rendering is stateless - every block's visual state is a
pure function of t (gsap.parseEase supplies the curves), so scrubbing in
either direction is always safe. New trigger event: When the timeline
ends. Optional auto-advance to the next slide.

## Narration audio
Set narration on the slide timeline. The audio IS the clock: t reads
audio.currentTime, seeking the bar seeks the audio, and the audio's real
length overrides the configured duration once metadata loads. Autoplay
rejection falls back to the rAF clock so visuals never stall.

## Code block (Rise-style, both directions)
The Code block takes HTML, CSS (auto-scoped to the block), and JS. JS
runs at runtime only (never on the authoring canvas), IIFE-wrapped, with
`root` (the block element), `gsap`, and `forge` in scope:
setVariable/getVariable/onVariableChange/complete/goToSlide. That makes
custom code a first-class trigger citizen: code sets a variable, triggers
react.

## Rise 360 publish target
Packages course.html plus rise-code-block.html: an iframe snippet for a
Rise Code Block with a postMessage completion bridge (course 'completed'
-> BLOCK_COMPLETED to the Rise page). Host the course file, replace
COURSE_URL, paste the snippet. The course file uses the same message
contract as the Storyline web object, so one hosted file serves both.

## Player navigation
Built-in prev/next slide buttons in the HUD whenever a course has more
than one slide.

## PPTX import
Import PPTX in the toolbar converts a PowerPoint into an editable
project: text boxes -> text blocks (size/position from EMU/9525, first
run's font size), pictures -> image blocks (embedded as data URLs),
speaker notes -> slide notes (shown in slide properties), slide size from
sldSz, one level of group offset flattening. Namespace-aware parsing;
slide files sorted numerically. Known gap, by design: shapes that inherit
geometry from layout/master placeholders land with defaults - this is an
editable starting point, not a fidelity renderer.


# v4

## Timeline shows the whole slide
The timeline strip now groups rows by layer and shows every block: timed
blocks as accent bars, untimed blocks as muted full-width bars. Dragging
or trimming an untimed bar promotes it onto the timeline in one undo step.

## Speaker notes narration (TTS)
Slide notes are editable in slide properties. With a timeline, enable
"Narrate speaker notes" and pick a browser voice and rate. Patterns from
the PPTX Narrator work apply: duration is estimated at 14.5 chars/sec x
rate, an epoch guard invalidates stale utterances, speak() is deferred
50ms after cancel() (Chrome drops it otherwise), and seeking restarts
speech from the proportional character offset snapped to a word start.
The rAF clock stays authoritative; the utterance ending snaps it forward.

## PPTX import, round two
- Placeholder inheritance: shapes without a local xfrm resolve their
  geometry from the slideLayout's matching placeholder (type|idx).
- Preset shapes import as shape blocks: prstGeom mapped to 16 kinds, fill
  and line color/width read from spPr. Text inside a filled shape becomes
  a centered text block stacked on it.
- mc:AlternateContent walks the Fallback branch; graphicFrame
  (tables/charts/SmartArt) is skipped with a warning.
- Text color and bold come through on first runs.

## Editor
- Insert is a grouped dropdown menu (Basics / Media / Interactive).
- Preview slide button previews from the currently selected slide.
- Color properties use a swatch picker + hex field (shape fill/border,
  text color). Text gains color and bold.
- 16 shape presets rendered as stretch-to-fit SVG (PowerPoint scaling
  model), non-scaling strokes.
- Reordering: layers move up/down (base stays pinned), blocks get To
  back / Back / Fwd / To front (DOM order is stacking order), slides
  already reorder in their panel.


# v4.1

## Colors
- Course theme accent (slide properties, Course theme): new shapes and
  buttons take this color instead of the built-in mint. Buttons gained
  fill and text color with automatic contrast when unset.
- PPTX import now resolves PowerPoint THEME colors: schemeClr references
  look up clrScheme in ppt/theme/theme1.xml (with tx/bg aliasing and
  lumMod/lumOff tints approximated in linear RGB), and shapes without an
  explicit fill fall back to their style fillRef/lnRef. This is why
  imports previously looked uniformly green - most real decks color by
  theme reference, not literal srgbClr.

## Editor
- Snap is a toggle in the canvas meta bar; holding Alt inverts whichever
  mode is active for one gesture.
- The stage clips: anything past the edges is hidden in the editor and
  the player alike, so authoring matches what learners see.
- File pickers are a click-anywhere browse area plus a URL field.
- Animate is its own right-panel tab (timing + entrance/exit animation
  moved out of Properties). The timeline strip continues to show every
  layer and block on the slide.


# v4.2

## Layout
The timeline strip sits below the stage (canvas over strip in a column),
where a timeline belongs.

## Voice
- PPTX import: slides with speaker notes arrive narrating - a timeline is
  created with TTS from the notes and auto-advance on, the Narrator
  behavior. Swap in recorded audio or disable per slide.
- Native recording: Record narration (mic) in slide timeline properties
  captures via MediaRecorder (webm/opus), embeds as a data URL, sets the
  slide duration to the take length, and replaces TTS. The audio block's
  properties have the same recorder for effects and clips.

## Audio on the timeline
Audio (and video) blocks with timing behave as tracks: TimedMedia
reconciles each element against the slide clock every tick - starts at
the bar's start, follows seeks within a 0.3s drift tolerance, pauses with
the transport, stops past the bar's end. Timed audio hides its own
controls at runtime; the slide transport is the transport.


# v5

## Trigger events
New events: When an object enters the frame (its timeline bar starts),
When an animation completes (its animate-in finishes), When the state of
all of... (every checked block reaches a chosen state), and When Submit
is pressed. Crossing detection runs in the player clock tick (forward
motion only; scrubbing back re-arms).

## Block states
Shape, button, image, text, and hotspot blocks support per-state visual
overrides (fill/border/text/opacity): Hover, Down, Selected, Visited,
Disabled. Defining a state switches its behavior on - Selected toggles on
click, Visited marks after the first click, hover/down follow the
pointer, Disabled and Hidden are set by the new Set block state trigger
action. Interactive blocks are keyboard accessible: tabbable, Enter/Space
clicks, visible focus outline.

## Player chrome
Project-level Player settings (slide properties > Player): Back / Next /
Submit with editable labels and show toggles, a Menu button opening a
slide-list drawer, and learner voice controls. Triggers can gate Next,
Back, and Submit per slide via the Enable/disable player button action
(state resets each slide visit). Submit fires the onSubmit event.

## Learner voice controls (the Narrator model)
On TTS-narrated slides the player shows a voice select and rate slider -
the exact treatment from the PPTX-to-SCORM app: English voices sorted
Neural > Google > Microsoft with cleaned display names, changes apply
mid-utterance by restarting from the current position, choices persist in
localStorage. Hide them with the Player setting.

## Resizable panels
Drag the dividers to resize the left sidebar, right sidebar, and the
timeline strip; sizes persist. (This flushed out a layout bug: the
workspace was a fixed 3-column grid that the splitter children broke -
it is flexbox now.)


# v5.1

## Layer renaming
Every layer now has a rename button (pencil) in its row, and double-click
on the name still works. The base layer can be renamed too - its behavior
stays fixed (always visible, not deletable) but the name is just a label.
Enter or blur commits; Escape cancels without saving.


# v5.2

## Bake TTS voices to audio files
Slide properties > Bake narration to a file: choose a system voice and
rate, pick WAV or MP3, Preview aloud, then Bake. The result can be
downloaded, set as the slide's narration (drives the clock), or dropped
onto the timeline as a placed audio block.

Why it works the way it does: browsers do not let Web Audio tap
speechSynthesis output, so the only pure-browser way to capture a system
voice is to record this tab's own audio (getDisplayMedia) while the voice
speaks - the picker asks you to choose "This Tab" and enable "Also share
tab audio." The captured audio is decoded, silence-trimmed at both ends,
and encoded to WAV (from-scratch PCM writer) or MP3 (pure-JS encoder).
Baking needs the editor served over https or localhost (a secure
context), not a file:// page. The baked file embeds in the course like
any other audio and never needs the learner's browser to have the voice.


# v5.3

## Baking uses real in-browser synthesis (fixed)
The tab-audio capture approach is gone - it could not reliably capture
system voices (silent on many setups, impossible on Mac). Baking now
SYNTHESIZES the waveform in the browser with Kokoro-82M (ONNX/WASM),
loaded from a CDN on first use (~86MB, then cached). Pick a voice and
WAV/MP3, Bake, then Download / Set as narration / Add to timeline. No
screen-share prompt, same result on every OS, baked file embeds in the
course.

## Player chrome no longer clipped
The player is a proper column now: the stage scales in its own area and
the transport, title, and Back/Next/Submit/hamburger live in a chrome bar
below it. Previously the chrome was absolutely positioned inside the
scaled stage and got cut off at the edges.

## Name objects
Every block has a Name field (top of its properties); the name shows on
its timeline bar and in trigger pickers/checklists.

## Timeline length + hamburger menu
The timeline strip header has an editable length field (disabled when a
narration file/voice drives the clock). The player Menu is a top-left
hamburger opening a full-height, high-contrast slide-list drawer.

## Save / Load
Export and Import are now labeled Save and Load.

## Align
Block properties gained Align: to the stage or (Shift-click 2+ blocks) to
each other - left/center/right, top/middle/bottom - plus Distribute
H/V for 3+ blocks.


# v5.4

## Player chrome rebuilt (no more clipping)
The player is a column: the stage scales in its own area with a proper
chrome bar beneath it holding transport, title, and Back/Next/Submit. The
old absolutely-positioned chrome that got cut off at the stage edges is
gone.

## Align to stage or to each other
Block properties gained Align: to the stage, or (Shift-click 2+ blocks on
the canvas) to each other - left/center/right, top/middle/bottom - plus
Distribute H/V for 3+ blocks. Shift-click builds a multi-selection shown
with a dashed ring.

## Timeline: animation ramps, z-order rows, snap toggle
- Each bar shows draggable animate-in and animate-out ramps at its ends
  (Storyline-style); drag the ramp handle to set the duration.
- Rows are ordered by stacking (top of the z-order first) and each has
  up/down buttons to move the block forward/backward - reordering z-index
  straight from the timeline.
- Snapping to a 0.1s grid is a toggle in the timeline header.

## Screen readers
Every block has a Screen readers setting: Auto (exposed only if it
carries text/alt - the default, so decorative shapes are hidden),
Always include, or Always exclude, plus an optional screen-reader label.
Applied as aria-hidden / aria-label in the player.

## Google Fonts + rich text
- Text blocks pick from a curated Google Fonts list; the font loads on
  demand and is embedded in published courses via a <link>.
- Double-clicking a text block shows a formatting toolbar (bold, italic,
  underline, lists, alignment, link, clear).

## GSAP animations in more places
- Text entrances: Fade in, Blur in, Typewriter, Words rise, Letters rise
  (per text block, plays when it enters the frame).
- Looping emphasis per block: Pulse, Bounce, Float, Shake.
- Slide transitions between slides: Fade, Slide, Zoom (course setting).


# v5.5

## Fixes for reported issues
- Text boxes that overflow now show a scrollbar instead of clipping.
- Timeline animation ramps moved to a thin strip of diamond handles along
  the bar's top edge, so the bar body (and its start) stays easy to grab
  and drag - the ramp handles no longer block the beginning.
- The timeline length control is clearly labeled "Length (s)" in the strip
  header; type a number to set how long the slide runs (disabled only when
  a narration file/voice drives the clock).
- Multi-select: Shift-click blocks on the canvas to select several (dashed
  ring), then Align > "To each other". The align panel spells this out.
- Cut / copy / paste blocks across layers and slides: Ctrl/Cmd+X / C / V,
  or the Clipboard buttons in a block's properties. Paste drops onto the
  currently selected layer, so moving a block from the base layer to
  another layer or slide is: copy, select the target, paste. Ctrl/Cmd+D
  duplicates in place.

## The two real animation bugs, fixed
- Emphasis (pulse/bounce/float/shake) now fires reliably, including on
  blocks that are also on the timeline. The cause was React rewriting the
  block's transform every frame and wiping GSAP's; emphasis now runs on a
  separate inner layer GSAP owns outright, so the two never conflict.
- The seekbar now reverses text animations (typewriter, words/letters
  rise, fade, blur) when you scrub. They were fire-once GSAP tweens;
  they're now a stateless function of timeline position, recomputed every
  frame like the rest of the timeline - scrub either direction and they
  track exactly.


# v5.6

## Reported fixes
- Timeline bar is easy to grab from the start now: the animate-in/out ramp
  handles sit on a strip ABOVE the bar (small diamonds), so the entire bar
  body - including its left edge - drags the block's start time. The ramp
  diamonds only adjust the animation lengths.
- Set-length indicator: when a slide's content runs longer than the length
  you set, a dashed red marker shows your set length and the region beyond
  it is shaded, so it's obvious the slide runs longer than the number.
- Paste is now paste-in-place (same coordinates). Ctrl/Cmd+D duplicates
  with a small offset when you want an offset copy.
- Selecting more than one block now defaults Align to "To each other"
  instead of the stage (either chip still overrides).
- Typewriter (and letters-rise) keep their spaces. Space characters stay
  real text nodes instead of collapsing inline-block spans, which is what
  was eating them.

## GSAP animations for every block, not just text
Entrance/exit animations and looping emphasis were already available to
every block type through the Animate tab and timeline - shapes, images,
buttons, all of them - but the shared set was thin and text had the only
"special" effects, which made it look text-only. This release:
- Expands the shared entrance/exit set with GSAP-driven Spin in, Flip
  (horizontal/vertical), Bounce in, Wipe up, Pop + rotate, and Zoom out,
  on top of the existing Fade/Slide/Zoom. All are stateless functions of
  timeline position, so the seekbar reverses them for any block.
- Surfaces Emphasis (Pulse/Bounce/Float/Shake) in the Animate tab for
  every block, next to entrance/exit, so all animation lives in one place.
The genuinely text-only effects are Typewriter and Words/Letters rise,
which don't have a meaningful equivalent for a shape or image.


# v5.7

## Audio is a first-class timeline object
Audio no longer has a confusing split personality. Previously "Set as
narration" hid the audio inside the slide's settings (invisible, not
manipulable) while "Add to timeline" made a real block - two ways to do
almost the same thing. Now:
- Audio always lives on the timeline as a normal block. It shows a clear
  chip on the canvas (speaker + label + waveform) and a labeled bar on the
  timeline you can move, trim, reorder, and attach triggers to.
- On the timeline it autoplays when its bar is reached, follows the
  seekbar, and pauses with the slide - exactly like any other timed
  object, via the same media-sync the player already used.
- The bake panel's buttons are now "Add to timeline" (a normal, visible,
  controllable audio block) and "Add as narration" (the same kind of
  block, just flagged hidden-in-player and set to drive the slide length).
  Narration is now just a role a block can have, not a separate hidden
  mechanism.
- Audio properties gained a Label field and a "Hidden in player
  (narration track)" toggle, so you can turn any clip into narration or
  back without re-baking, and the timed-audio hint explains the autoplay
  behavior.


# v5.8 (release candidate)

## Timeline: trim the start like the end
Each bar now has a start handle on its left edge that mirrors the end
handle: drag it to change when the object starts WITHOUT moving the whole
bar (it trims from the front, leaving the end anchored). The bar body
still drags to move the whole thing.

## Audio waveforms
Audio clips now show their REAL decoded waveform - on the canvas chip and
along the timeline bar - so you can line up visuals to the sound. Decoding
happens once per clip and is cached.

## Grab and move multiple objects
- Shift-click several blocks, then drag any one of them and they all move
  together.
- Drag on empty canvas to rubber-band (marquee) select everything the box
  touches; Shift starts an additive marquee that adds to the current
  selection.

## More animation
- New looping emphasis options: Heartbeat, Wobble, Tada, Glow (on top of
  Pulse, Bounce, Float, Shake) - available for every block in the Animate
  tab.
- Entrance/exit set already includes Spin, Flip (H/V), Bounce in, Wipe up,
  Pop + rotate, Zoom out for every block.

## More triggers
- New events: When block is hovered, When block is double-clicked.
- New actions: Play audio, Pause audio, Pulse / emphasize a block, Pause
  the timeline, Resume the timeline, and Jump the timeline to a time.
  These let you wire up things like "hover a hotspot to make a hint bounce"
  or "click to start narration," and give you an explicit way to fire
  emphasis on demand.

## Polish
Independent panel scrolling, clearer handles, and consistent selection
behavior across drag, marquee, and clipboard.


# v5.9

## PowerPoint import: its colors AND its fonts
- Imported text now keeps the deck's real run color (including theme colors
  and paragraph-level defaults, which some exporters use), not a default.
- The font family each text run uses is imported and applied.
- If the PowerPoint embeds its fonts, those font files travel with the
  project as @font-face and render in the editor, the player, and published
  courses - so the deck's own typeface shows even when it isn't a Google
  font.

## Vertical text align
Text blocks gained Top / Middle / Bottom vertical alignment.

## Object grouping
Select two or more blocks and Group them (Ctrl/Cmd+G); clicking any member
selects and moves the whole group. Ungroup with Ctrl/Cmd+Shift+G or the
button.

## Color picker no longer freezes (Edge fix)
The color control now commits once when the picker closes instead of on
every drag tick, which is what could lock the native picker open on Edge
and force a hard close. Live preview still updates as you drag.

## Voice preview + calmer model download
- A "Preview voice" button synthesizes a short sample so you can hear a
  voice before baking a whole slide.
- The one-time voice-model download now shows a clear progress bar and a
  "Download voice model" button so it never looks like a freeze, and a note
  that you can keep working while it loads.

## Scrollbar sensitivity
Text no longer shows a scrollbar the moment it's a pixel too tall. It hides
overflow by default; a "Scroll overflow" toggle turns on a scrollbar for
boxes that intentionally hold long, scrollable text.

## More interactivity: Matching
A new Matching (mix-and-match) interaction: author prompt/answer pairs,
learners connect them, and it scores on Check with feedback and retry.

## Menu revamp + player options
- The toolbar buttons now have icons; the redundant "Play in tab" is gone
  (Preview covers it).
- Player options: show/hide the menu, LOCK the menu to view-only (no
  jumping ahead to unvisited slides), a course progress bar, a player
  accent color, light/dark/minimal chrome, and button shape (rounded/pill/
  square) and style (solid/outline).

## Panels: collapse and resize
Each panel (slides+layers, properties, timeline) can be collapsed to a thin
rail and reopened, on top of the existing drag-to-resize splitters - so you
can reclaim space when you need the canvas.


# v6.0

## Image clipping to shapes + a pen tool for custom shapes
This is the big one, built on the same custom-geometry approach used in Layer
Lift and the PPTX Narrator renderer.

**Clip an image to a shape.** Select an image and pick a shape from "Clip to
shape" (star, hexagon, diamond, arrows, chevron, and the rest). The image is
masked to that shape via a real CSS clip-path, so it scales cleanly with the
block and renders identically in the editor, the player, and published
courses.

**Pen tool for a custom clip mask.** Click "Draw custom clip" on an image to
open the pen editor. The image shows underneath at reduced opacity so you can
trace it. Click to drop nodes, drag a node to move it, double-click a node to
remove it. Apply and the image is clipped to your custom polygon - odd
shapes, silhouettes, cut-outs, whatever you draw.

**Pen tool for custom shapes.** The same editor works on a shape block: draw
any polygon and it becomes the shape's geometry, replacing the preset. It
fills, takes a border, animates, and clips just like the built-in shapes.

Custom points live in the same 0..100 coordinate space as the preset
geometry, so a drawn shape or clip stretches with its block the way
PowerPoint geometry does.


# v6.1

## One color picker, crash fixed at the root
The color field is back to a single implementation: the browser's native
swatch popup (with its built-in eyedropper) plus a hex field. The crash
that motivated the extra custom eyedropper button was diagnosed and fixed:
React's synthetic onChange on <input type="color"> is an alias for the
'input' event, so every tick of an eyedropper drag was committing a
full-project undo snapshot (two deep clones of a document that embeds
data-URL media) - a render/clone storm that froze the tab. ColorInput now
previews locally during interaction and commits exactly once, from the
NATIVE 'change' event, when the popup closes or the eyedropper picks. The
custom eyedropper button and its debounce machinery are removed.

## One audio pipeline
Browser speechSynthesis is gone (engine, voice list, learner voice
controls, TtsSettings). Everything speaks through files: attach an
existing audio file, or bake speech with Kokoro - always to MP3 - and the
result plays through the one file-based player path (audio elements,
TimedMedia against the slide clock, playAudio/pauseAudio triggers).

Text blocks gained an Audio section with exactly two options: **Add
audio** (attach a file) and **Bake audio** (synthesize the element's text;
the MP3 becomes the element's permanent audio). Attached audio plays when
the element appears, or with its timeline bar on timed slides. Slide-level
narration baking remains and now shares the same AudioBaker component.

## Insert menu: categories + visual shape picker
Insert opens a two-pane menu: category rail (Shapes / Text / Media /
Interactive / Widgets) and a content pane. Shapes render as a grid of
real geometry thumbnails (the same ShapeSvg the canvas uses), so you
recognize the shape instead of reading its name; picking one inserts a
shape block already set to that kind. The same ShapePicker replaces the
long dropdown in shape properties. New insertables scale by adding one
entry to a category - the toolbar never grows.

## Run + File menus
The toolbar now holds only always-on editing controls (Insert, undo/redo).
Preview project / Preview this slide / Publish live in a Run menu; New /
Demo / Save / Load / Import PPTX live in a File menu. Future targets
(SCORM export, HTML export, share) slot into Run without new buttons.


# v6.2

## Color editing: live fill + gesture-scoped undo
Dragging in the native color popup (or its eyedropper) now previews the
fill on the canvas live. The first tick opens a store "gesture" - one undo
snapshot, then record() is suppressed - live ticks commit throttled and
history-free, and the native change event commits the final color and
closes the gesture. One drag = one undo step, no clone storms.

Fixed alongside it: picking a color could flip the shape to Rectangle.
The shape grid lived inside a <label>, and browsers forward clicks on a
label's non-interactive area to its first labelable descendant - the
rectangle tile. Button-holding fields render as ButtonField (a div) now.

## Shapes
- Flowchart database redrawn with closed subpaths (the old open arcs
  filled as lenses and looked broken).
- Callouts are parametric: drag the orange tail handle to point the tail
  anywhere, Storyline-style (ShapeProps.tail, 0..100 space, may extend
  past the block).
- Lines and arrows, PowerPoint-style: Insert > Shapes has Line and Arrow;
  each line end takes a type (triangle, stealth, open, oval, diamond) and
  size (S/M/L) that scales with line width. PPTX import maps headEnd /
  tailEnd type+len 1:1 - no more oversized fixed heads.
- Pen tool: right-click any shape to edit its geometry (presets seed
  their points), "Smooth curves" renders the nodes as a closed
  Catmull-Rom spline, and Apply trims the drawing to its content -
  points normalize to their bounding box and the block resizes to match.

## Groups
- Selecting a group child (timeline row, or double-click into the group
  on canvas) now shows its real property panel, so colors and text are
  editable in place.
- Timeline group children list top-most first like every other row, and
  the forward/back buttons disable on the correct ends.

## Player
- Initial state "Hidden" is honored: entering a slide seeds each block's
  authored initial state (groups included); triggers can then show or
  change it. Hidden group children can be revealed by triggers too.

## Editor timeline
Click or drag the ruler to place a playhead: the canvas previews that
moment - absent blocks ghost to 15% (still selectable), entering/exiting
blocks render mid-animation. A chip in the timeline header clears it.

## Editing
- Shift while resizing keeps the block's aspect ratio (corners scale by
  the dominant axis; edge handles derive the other dimension).
- File > Save overwrites the current file (prompting only the first
  time); Save as... always prompts and the new file becomes current.

## Baking
Synthesis yields to the event loop between sentences so the progress bar
actually repaints (Kokoro's WASM blocks the main thread per sentence -
the bar used to look frozen), and the fill has a shimmer while a long
sentence synthesizes.


# v6.3

## Callouts are one seamless path
A callout is now ONE closed path: the body boundary with the tail spliced
in (the convex boundary is walked around the tail's angular gap, then two
straight edges run to the tip). No more body + overlay triangle, so the
corners join seamlessly, the border runs unbroken around the whole
outline, and clip effects (wipe) treat callouts exactly like standard
shapes. Rounded-rect corners intersect the tail correctly via ray/circle
math.

## One animation per effect; direction is an option
Slide/Wipe/Flip (and Rise) are single library entries with a Direction
option (Up/Down/Left/Right) instead of per-direction entries. Legacy
values (slideUp, wipeUp, flipX...) migrate on read via normalizeAnimSpec.
Wipe clips from any side; the non-wiped sides get a negative clip inset so
overflowing geometry (callout tails, arrowheads) wipes with the shape
instead of being chopped at the block edge.

## Rise animation, actually rising
New Rise entrance: long decelerating travel (default 160px, configurable
Distance), fade completing early so the motion reads - PowerPoint's Rise
Up, not a 40px nudge. Slide also takes a Distance.

## True vector editing (shapes AND clips, one engine)
The pen editor is a Bezier editor now: anchors with real handles
(ShapeProps.nodes / ImageProps.clipNodes, 0..100 space).
- Click empty space to append an anchor; click the outline to insert one
  mid-segment (curves split exactly via de Casteljau).
- Select an anchor to edit its handles; smooth anchors keep them
  mirrored. Smooth / Corner / Straight convert the selected anchor;
  Smooth all curves the whole outline.
- Path presets (heart, cloud, terminator...) seed their real curves, so
  right-click > edit starts from what's on the canvas.
- Image clips use the same engine and editor; curved clips render through
  an SVG clipPath in objectBoundingBox units (CSS polygon() can't curve).
Legacy pen polygons still render and migrate to nodes on their next edit.

## Hidden initial state removed
The partially-working "Initial state: Hidden" block property is gone (UI,
schema, runtime seeding). Show/hide triggers (setState hidden) still work
- that path was always reliable.

## PowerPoint-style shadows
Block-level ShadowSpec: color, opacity, blur, distance, angle, inner or
outer, plus a preset gallery. Outer shadows render as a drop-shadow
filter on the block's content wrapper so they follow the real silhouette
(SVG geometry, callout tails, clipped images); inner shadows render
inside ShapeSvg as an SVG filter (inset box-shadow approximation on
non-shape blocks). PPTX import reads outerShdw/innerShdw fully (blurRad/
dist EMU, dir/60000, color alpha) instead of collapsing to a hardcoded
soft shadow.

## PPTX import: real font sizes and vertical anchors
Font sizes are points and now convert at 4/3 px/pt (30pt -> 40px; they
imported ~25% small before), and bodyPr anchor="ctr"/"b" maps to the text
block's vertical alignment - the two things that made re-imported slides
(the "slide 4" report) look smaller and mis-centered than the deck.

## Stale builds removed
editor.html / editor_updated.html at the repo root were year-old v5.x
builds; opening them resurrected the old toolbar/preview and its export
bugs ("only the last slide"). They're deleted - the editor is dist/
index.html (or npm run dev). The current single-file web export embeds
every slide and navigates them (verified end to end).


# v6.4

## Timeline & layer locking
Padlocks everywhere they're needed: per-row in the timeline, per-layer in
the Layers panel and timeline layer headers, and a lock-all toggle in the
timeline head. A locked block stays selectable (so the lock is
discoverable) but refuses moves, resizes, nudges, deletes, timeline bar
drags, and ramp (keyframe) drags. Locked rows/bars/blocks read clearly
(red dashed bar, lock badge); locked blocks are also skipped by marquee
selection and multi-drags.

## Pasteboard (off-stage editing)
The editor no longer clips at the slide edge: a scrollable pasteboard
surrounds the slide (Illustrator-style), so assets can be staged outside
the visible area, fully editable, with snapping intact. The slide edge is
a crisp outline; the player still clips to the slide, so off-stage
objects never appear in Preview or exports.

## Marquee selection from anywhere
Drag-select can start on the stage, the pasteboard, or the outer canvas -
anywhere that isn't a block - and selects everything the box touches,
off-stage objects included.

## Multi-selection, first-class
- A dashed bounding box wraps 2+ selected blocks; drag its corner to
  resize the whole selection together (Shift keeps proportions).
- Selecting several blocks opens a shared properties panel: fill, border,
  font size/color, rotation, lock, emphasis, shadow - each writes to every
  selected block - plus align/distribute/group and delete.
- Blocks gained rotation (degrees, around center), rendered in editor and
  player; the multi panel rotates the whole selection together.

## Timeline row reordering
Drag a row (its grip or name) up and down to restack - the z-order
updates live as you drag, and multi-selected sibling rows travel
together. Works for top-level rows and inside expanded groups.

## Audio scrubbing
Dragging the timeline playhead now plays synchronized snippets of
everything audible at that moment - narration, audio blocks, block-attached
audio - so animations can be synced to speech by ear, Premiere-style.

## Player: navigation in a collapsible left sidebar
The published player and Preview moved navigation out of the bottom bar:
a hamburger (top-left) toggles an animated left panel holding the course
menu and Back/Next/Submit. The panel remembers its state while the course
runs, and the bottom bar keeps only the transport and HUD - more vertical
space for content. Editor chrome is unchanged.

## Save remembers its file across sessions
The save-file handle now persists in IndexedDB: reopen the editor and
Save still overwrites the same project file (the browser re-confirms
write permission on the first save). Save As targets a new file, which
becomes current; cancelling it keeps the old target.

## Pen editor: true proportions
The pen canvas now matches the block's aspect ratio instead of being a
square, so drawn or traced artwork is WYSIWYG - Apply no longer stretches
or squashes the result. Image tracing also honors the image's fit
(contain letterboxes, cover crops), and Insert > Shapes gained a
"Custom shape" entry that drops a block and opens the pen directly.

## PowerPoint animations and triggers import
- p:timing parses into real timeline animations: Fade/Appear, Fly In
  (direction + long travel), Peek In, Wipe (direction from its filter),
  Zoom, Rise Up/Ascend, Bounce, Flip; exit effects set the block's end +
  animate-out. Click groups sequence onto the clock (each click's effects
  start when the previous group ends); "with previous" and delays are
  honored. Slides with animations get a timeline sized to fit.
- Interactive ("start on click of") sequences become real triggers: the
  targets hide on slide load and show when the source shape is clicked.
- Hyperlink jumps (hlinkClick to a slide, next/previous/first/last)
  become onClick goToSlide triggers.


# v6.5

## Fixes and follow-ups from v6.4 feedback
- **Pinned canvas overlays.** The zoom control and the size/snap chip now
  live OUTSIDE the scrolling pasteboard, pinned to the canvas corners -
  they no longer drift over the slide as you scroll.
- **Player nav back in the bottom bar.** Back/Next/Submit returned to the
  player's bottom bar; the hamburger sidebar holds only the course menu.
  New player option: nav buttons position (bottom bar left or right).
- **Full Kokoro voice set.** The bake picker now lists all 28 English
  Kokoro-82M voices with their real names plus accent/gender labels,
  ordered by the model card's quality grades (Heart, Bella, Nicole,
  Fenrir, Michael, Emma, ...).
- **Timeline Play button.** Play the timeline right on the canvas: the
  playhead advances, blocks animate mid-flight, and every audio source
  (narration, audio blocks, attached audio) plays in sync - no full
  Preview needed. Pause anywhere; scrubbing the ruler stops playback.
- **Save, desktop-style, for real.** New File > "Set project folder...":
  pick a folder once and Save writes <title>.elearnforge.json into it
  with no prompts (the folder persists across sessions). Save As always
  asks for the name. If the editor runs from a file:// URL the browser
  forbids in-place writes entirely - the fallback alert now says exactly
  that and points at running over http (npm run dev / dist on localhost),
  which is why Save was "creating a new file each time".


# v6.6

## PPTX import fidelity (the "Phishing Awareness Deck" issues)
- **No more clipped text.** Text blocks stopped hiding overflow - like
  PowerPoint, text taller than its box paints past it ("Scroll overflow"
  still opts into a scrollbox). Autofit is honored too: normAutofit
  fontScale multiplies every run size, so autofit decks import at the
  size PowerPoint actually rendered.
- **Line spacing imports.** a:lnSpc spcPct maps to a real line-height
  (single spacing = 1.2, tighter than the editor default); text blocks
  gained a lineHeight prop.
- **Fonts: embedded first, metric-compatible substitutes second.**
  Families the deck embeds keep their names (the @font-face wins).
  Non-embedded Microsoft fonts substitute to metric-compatible Google
  fonts - Calibri->Carlito, Cambria->Caladea, Arial->Arimo, Times->Tinos,
  Courier->Cousine, Georgia->Gelasio and friends - so widths, line breaks
  and box fits survive. Every substituted family is added to the
  project's font list so it actually loads.
- **Groups stay groups.** p:grpSp imports as a real group block: children
  transform through chOff/chExt (including group scaling) into
  group-relative coordinates, so imported groups move, scale, animate,
  and edit together. Nested groups flatten into their parent.

## More animations
Six new entrances: Grow (from nothing), Stretch (unfolds horizontally),
Unfold (vertically), Drop in (configurable fall distance - pair with a
bounce ease), Swivel (full Y-axis turn), Whip in (fast angled swing,
direction + distance). All scrub, reverse, and export like the rest.

## Storyline-style variable references
Text substitutes %Name% at runtime: project variables by name plus
built-ins - %SlideNumber%/%CurrentSlide%, %TotalSlides%, %SlideName%,
%ProjectName%/%CourseName%, %ProgressPercent%, %ViewedSlides%,
%ScorePercent%, %Date%, %Time%, %RandomNumber%. Live: values update as
variables change. The Variables panel documents the list.

## New trigger actions
Open URL (new tab), Toggle block visibility, Restart the timeline.

## Player button effects
Player options for the nav buttons: hover effect (Lift / Glow / Scale /
Brighten) and a looping emphasis on the enabled accent buttons
(Pulse / Glow) - the "make Next impossible to miss" knob.


# v6.7

## Text properties + editing
- Line height and letter spacing controls on text blocks.
- "Clear formatting (HTML)" button strips inline HTML to plain text
  (keeping paragraph breaks) so the panel's font/size/color take over.

## Multi-object animation
Selecting 2+ blocks and opening Animate applies one entrance or emphasis
to the whole selection at once. (Properties already applied fill, border,
text, shadow, rotation and lock to multi-selections.)

## Player: title placement
New player option - the course title can sit in the bottom bar (default),
in a title bar ABOVE the stage, or be hidden.

## Richer trigger logic
- Conditions combine with AND (all) or OR (any).
- New condition operators: between, doesn't contain, starts with,
  ends with, is empty, is not empty.
- New trigger event: on mouse leave.


# v6.8

## Timeline: cue marks + multi-select + sticky ruler
- **Cue marks**: add named markers on the ruler (◇ button at the playhead).
  They render on the ruler with guide lines, click to seek, right-click to
  delete, and a new trigger event "When the timeline reaches a cue" fires
  when the playhead crosses one.
- **Multi-select rows**: Shift/Cmd/Ctrl-click timeline rows to select
  several - the same multi-selection the canvas and property panels use
  (so multi-move, multi-property and reorder all apply).
- The ruler (and the "Blocks" header) is now **sticky** at the top of the
  timeline while you scroll long slides.

## Text animation regression fixed
Typewriter / Words rise / Letters rise no longer put every word on its own
line. The text box's vertical-align flex column was turning each animated
word span into a flex item; content now renders in an inner element so the
spans flow inline again.

## Animation preview + multi exit
- A "▶ Preview animation" button in the Animate panel plays the selected
  block's entrance on the canvas, so Direction / Distance / easing changes
  are visible without opening full Preview.
- Multi-select Animate gained an Exit dropdown (alongside Entrance and
  Emphasis), applied to the whole selection.

## Player
- The seekbar stretches across the chrome bar (no longer capped short).
- More slide transitions: fade, subtle slide, slide from left/right,
  slide up, zoom in/out, and flip.

## Triggers (from the prior batch)
AND/OR condition logic; operators between / doesn't-contain / starts-with
/ ends-with / is-empty / is-not-empty; onMouseLeave event.


# v6.9

## Three new blocks
- **Fill in the blank** (Insert > Interactive): a prompt with ___ for the
  blank and a typed answer, scored against a comma-separated list of
  accepted answers (case-insensitive by default) with correct/incorrect
  feedback. Sets a boolean `fb_{blockId}_correct` variable on Check, so
  slide triggers can react - same contract as multiple choice.
- **Progress bar** (Insert > Widgets): a bar or ring driven by course
  progress (viewed slides) or a 0-100 number variable, with an optional
  percentage label and custom color.
- **Timer** (Insert > Widgets): counts up, or down from a set number of
  seconds. A countdown sets `timer_{blockId}_done = true` at zero for
  triggers, and has a start/pause control.


# v6.10

## Drag-and-drop interaction
A new **Drag and drop** block (Insert > Interactive): author groups (drop
targets) and items, each item tagged with its correct group. Learners drag
items from the bank into groups; Check scores every placement, shows
per-item right/wrong outline plus feedback, and sets a boolean
`dd_{blockId}_correct` variable for triggers. Reset re-banks the items.


# v6.11

## Tabs / accordion
A new **Tabs / accordion** block (Insert > Interactive): author any number
of labeled panels of HTML content. A "Tabs" layout shows a tab strip with
one panel visible at a time; an "Accordion" layout stacks expandable
sections (multiple can be open). Accent color and font size are
configurable. Same rendering in the editor, Preview, and published courses.

## Movable + renamable cue points
Cue flags on the timeline ruler are now interactive: **drag** a flag along
the ruler to retime the cue, **double-click** to rename it, and
**right-click** to delete it. Cue "When the timeline reaches a cue" triggers
follow the new time automatically, and flags re-sort after a move.

## Font-weight slider
The text panel's Bold checkbox is now a **Weight** slider (100-900) with a
live named readout (Thin … Regular … Bold … Black). It writes an explicit
`fontWeight`, and keeps the legacy `bold` flag in sync (700+ still reads as
bold) so older projects and inline-HTML detection keep working.

## Semantic text tags
The in-place editor's toolbar gained a **style dropdown** (Paragraph,
Heading 1-6) that wraps the current block in the correct element, and
Bold/Italic now commit as semantic `<strong>`/`<em>` rather than `<b>`/`<i>`.
Headings are sized relative to the block's font size so the panel's Font
size still scales everything. Same markup renders in Preview and published
courses.

## Baked narration remembers the voice
The bake picker now **defaults to the voice you last used** (persisted
across sessions) instead of resetting to the top of the list, and baked
narration tracks are **named after the voice** — e.g. "Narration (Heart)" on
the timeline and in the layers list — so it's obvious which narrator a clip
belongs to.

## More mass-editable properties
The multi-selection panel now edits more at once: for text blocks —
**font family, alignment, and weight**; for shapes — **corner radius**; and
for any selection — **width and height** applied to every selected block.
These join the existing shared fill, border, font size/color, rotation,
lock, emphasis, and shadow controls.
