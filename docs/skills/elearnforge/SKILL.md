---
name: elearnforge
description: Use whenever building, debugging, extending, or reasoning about eLearnForge, the browser-based eLearning authoring tool (React + TypeScript + Vite + Zustand) that compiles to a single offline-capable HTML file. It is a Rise/Storyline hybrid combining prebuilt content blocks with a canvas, layers, and a trigger engine, and it opens and saves Storyline .story files. Trigger on "eLearnForge", "the authoring tool", "canvas-per-slide", "block library", "trigger engine", "player options", "image clip / pen tool", "PPTX import", "Kokoro TTS", "Open Storyline", "Save as Storyline", "story import / export", "question bank", "lightbox slide", "SCORM / xAPI publish", or the architecture brief. Read this BEFORE writing feature or renderer code so you honor the existing architecture and conventions instead of reinventing them.
---

# eLearnForge: Authoring Tool Build Knowledge

A browser-based eLearning authoring tool positioned as a **hybrid of
Articulate Rise and Storyline**: Rise-style prebuilt **blocks** on a
Storyline-style **canvas with layers and a trigger engine**. React,
TypeScript, Vite, Zustand, compiled to a **single offline-capable HTML file**.

**Current state: v6.40** (November 2026). `CHANGELOG.md` has every release;
read its tail before assuming what exists. This skill is the map; confirm
specifics against the code.

## The single-file rule is inverted here

Nathan's other tools are hand-authored single HTML files with no build step.
**eLearnForge is the deliberate exception:** a multi-file React/TS app that
*compiles to* a single offline HTML file. Do not force it back into a
hand-rolled single file and do not add runtime CDN dependencies. The output
is still self-contained; the bundler does that.

## Layout

| Path | What |
| --- | --- |
| `index.html`, `player.html` | editor and player entry points |
| `src/schema/types.ts` | the data model: Project, Slide, Layer, Block, Trigger, Action |
| `src/schema/factory.ts` | new blocks and the demo course |
| `src/engine/runtime.ts` | the player runtime: variables, layers, triggers, navigation |
| `src/engine/validate.ts` | trigger validation shown in the editor |
| `src/blocks/<type>/` | one folder per block: `Canvas.tsx`, `Runtime.tsx`, `Properties.tsx` |
| `src/editor/` | editor UI (Toolbar, TriggersPanel, LayersPanel, StoryView ...) |
| `src/runtime/` | player UI (Player, PlayerChrome, Lightbox) |
| `src/publish/` | SCORM / xAPI packaging, PPTX import, Storyline import and export |
| `src/state/` | Zustand stores (`__forgeStore` is exposed on `window` for tests) |
| `docs/storyline-import.md` | what maps to what between eLearnForge and Storyline |

## Model

- **Canvas per slide.** A slide has a size, a background (colour, gradient or
  image), layers, triggers and a timeline. The first layer is the base layer.
- **Blocks** are positioned in slide pixels with `x, y, w, h`. Text blocks pad
  their content by 8px.
- **Block types (26):** text, image, shape, button, statement, video, audio,
  hotspot, labeledGraphic, tabs, flashcards, checklist, code, timer, progress,
  varDisplay, slider, scenario, results, group, and the questions:
  multipleChoice, matching, dragDrop, sequence, fillBlank, textEntry.
- **Also:** lightbox slides, question banks, modal layers, block states
  (normal, hover, selected, visited, disabled, hidden), per-slide Next / Back
  overrides.
- Image and shape geometry share a **0..100 coordinate space** with Layer Lift
  and PPTX Narrator (preset shapes, clip masks, custom polygons). If a
  rendering capability exists in that lineage, it is fair game here; do not
  defer a feasible feature with complexity excuses.

## Trigger engine

- **Events:** onClick, onDoubleClick, onHover, onMouseLeave, onSlideLoad,
  onTimelineStart, onTimelineEnd, onBlockEnters, onAnimationComplete,
  onCuePoint, onVariableChange, onStateAll, onKeyPress, onSubmit, onLayerShown
  (`Trigger.layerId`), onNext, onBack.
- **onNext / onBack replace the default navigation** when their conditions
  pass (`runtime.pressNav(dir)`, `hasNavTrigger(dir)`). That is how a custom
  Next works, the same as Storyline.
- **Actions:** show / hide / toggle layer and block, go to / next / previous /
  restart slide, set / adjust / reset variable, set state, set score, complete
  course, exit course, open / close lightbox, open URL, execute JavaScript,
  audio and timeline control, emphasis pulse, player button enable.
- Triggers can be disabled and carry conditions on variables, on a block's
  state, or on the quiz score (`Condition.score`, compared with a number). Graded
  questions can have a maximum number of attempts.

## Storyline `.story` support

File menu: **Open Storyline (.story)** and **Save as Storyline (.story)**.
Both show a report listing anything that did not convert. The format rules
live in the `story-file-internals` and `story-file-writing` skills; read those
before touching `storyImport.ts` or `storyExport.ts`.

- **Import** reads slides, masters and layouts, theme colours and fonts, text,
  pictures, shapes, video and audio with captions, states, layers, timing and
  entrances, variables and triggers. Freeform pick questions keep their own
  shapes; form questions and the other freeform types become native quiz
  blocks (`nativeQuestion` in `storyImport.ts`); result slides keep their
  design and read `%Score%` and `%PassPercent%`. Unsupported triggers become
  an Execute JavaScript note plus a warning.
- **Export** starts from a blank project saved by Storyline
  (`storyShell.ts`) and writes slides, text, shapes, pictures, layers, notes,
  variables, triggers, backgrounds, and quiz blocks as freeform Pick One, Pick
  Many and Drag and Drop questions. Tabs become a button and a layer per
  panel.
- Audio is written (MP3 plus captions) but not yet confirmed in Storyline.
- **Not written yet:** fill-in-the-blank, sliders, flashcards, scenario,
  result slides, video.
- Font sizes scale with slide width on both sides
  (`pt = px * 0.75 * 960 / slideWidth`).
- Client `.story` files are real courses. Keep them out of the repo.
- A change to the export is not done until a person has opened the result in
  Storyline. Send a small ladder of test files and wait for the answer.

## Other import and publish

- **PPTX import** pulls real run colours and font families (including from
  paragraph-level `defRPr`) and embeds the deck's own fonts as `@font-face`
  data URLs.
- **Publish:** single HTML, SCORM 1.2, SCORM 2004 4th edition, xAPI, a
  Storyline web object and a Rise code block, with compact resume data and a
  media compression check. Tracking adapters are in `src/tracking/`. SCORM was verified against an
  independent runtime and xAPI against a real LRS.
- **TTS:** Kokoro, with a voice preview and a calm model-download progress UI.

## Editor mechanics (verified, do not regress)

- Shift-click multi-select, marquee select, `Ctrl+G` / `Ctrl+Shift+G`,
  double-click into a shape inside a group.
- Timeline start-trim and end-trim handles; the left edge trims without moving
  the object.
- Real decoded audio waveforms on the canvas chip and the timeline bar.
- Layers panel: Alt+click the eye isolates a layer.
- Story view is a wrapping grid of real slide thumbnails.
- Text overflow defaults to hidden with an explicit "Scroll overflow" toggle.
- Colour pickers commit on close, not on every drag tick (Edge freezes
  otherwise).
- The course accent recolours the editor (`src/shared/accent.ts`).
- Preview has a Live values panel in debug mode.

## Tests and checks

- `npm test` runs the unit files in `tests/*.test.ts` through
  `scripts/run-tests.mjs`.
- `npm run test:e2e` builds, then runs the Playwright suites in
  `tests/e2e/*.e2e.mjs` through `scripts/run-e2e.mjs`. Pass a name to run one:
  `node scripts/run-e2e.mjs story-export`. Suites include axe accessibility
  checks.
- `tests/css-tokens.test.ts` fails on literal font sizes, border radii or
  overlay z-indexes in chrome rules. Use the design tokens.
- `scripts/capture-screens.mjs` regenerates the screenshots.
- Run the suites before calling anything done.

## Conventions

- ASCII-only comments; no em dashes in any narration text the tool emits.
- Surgical changes; discuss ambiguous scope first; never touch a part marked
  done.
- Develop on a branch and fast-forward `main` once a batch is confirmed.
  GitHub Pages deploys from `main`.
- Every release gets a `CHANGELOG.md` entry.
- This skill is the shared source of truth between sessions; update it when
  the architecture changes.
