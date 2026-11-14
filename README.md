# eLearnForge

A browser authoring tool for interactive e-learning: Rise-style content blocks
on a Storyline-style canvas with layers, a timeline and a trigger engine.
React + TypeScript + Vite + Zustand. Everything runs in the browser and
publishes to a single offline file.

## Run

    npm install
    npm run dev        # editor at localhost:5173, player at /player.html
    npm test           # unit tests (scoring, tracking, triggers, resume, checks)
    npm run build      # production build to dist/ (editor and player)

The build produces exactly two self-contained files in `dist/`: `index.html`
(the editor) and `player.html` (the runtime). All JS and CSS are inlined by
`vite-plugin-singlefile`, so they work from any folder, any host, or straight
from disk via `file://`. The player builds first and the editor bakes it in as
a string, which is how publishing works offline. Publishing from `npm run dev`
is disabled; publish from the built `dist/index.html`.

`dist/` is committed on purpose: the editor is distributed as that one file,
so people can open it without a build. GitHub Pages rebuilds it on every push
to `main`, after the tests pass.

## What it does

- **Authoring:** slides with layers (including modal layers), lightbox slides, question banks, 26 block types
  (text, media, quizzes, drag and drop, matching, flashcards, scenarios,
  results, code...), a per-slide and per-layer timeline with GSAP animation,
  narration (recorded, uploaded or synthesized in the browser), and PowerPoint
  import.
- **Logic:** triggers on slides (when X happens, if conditions, then actions),
  variables, block states, Execute JavaScript, key presses.
- **Scoring:** pass mark, pass-gated completion rules, score calculated from
  answers, max attempts.
- **Publish:** web (single HTML), SCORM 1.2, SCORM 2004 4th edition,
  xAPI, Storyline web object, Rise code block. A checks list and size estimate
  run before publishing.

Version-by-version detail is in [CHANGELOG.md](CHANGELOG.md).

## Architecture decisions
1. **Undo/redo** - snapshot history behind a single `record()` gate in the store.
   Gestures (drag, resize, arrow nudge) record once at the start, then mutate
   silently, so a whole drag is one undo step. Cap 100 snapshots.
2. **Property panels** - hand-built per block, sharing field primitives from
   `src/editor/fields.tsx`. Each block's three renderers (canvas, properties,
   runtime) live in `src/blocks/<name>/`, registered in `src/blocks/registry.ts`.
3. **Persistence** - IndexedDB autosave (debounced) plus explicit JSON
   export/import. Media embeds as data URLs, so keep files small.
4. **Tracking** - the engine emits semantic events (slide viewed, interaction,
   scored, completed) and knows nothing about protocols; each publish target is
   one adapter in `src/tracking/`.

## Schema notes
- Triggers live on the **Slide**. Variables live on the **Project**.
- `layers[0]` is the base layer: always visible, cannot be deleted.
- Question blocks create a boolean variable on insert (for example
  `mc_{blockId}_correct`). Keep these names; the player looks them up by name.
  The editor shows a readable label instead.

## Key paths
- `src/schema/`      types, factories, demo project
- `src/state/`       Zustand project store, IndexedDB persistence, UI store
- `src/engine/`      runtime and trigger engine (framework-free), scoring, validation
- `src/blocks/`      one folder per block: Canvas / Properties / Runtime
- `src/editor/`      canvas, panels, ribbon, Triggers panel, Publish dialog
- `src/runtime/`     standalone player (`player.html` entry)
- `src/tracking/`    SCORM 1.2 / 2004, xAPI, Storyline bridge adapters
- `src/publish/`     packaging, manifests, publish checks, PPTX import
- `tests/`           unit tests, run with `npm test`
- `fixtures/`        sample PowerPoint files for the importer

## Invariants to preserve
**Layer hit-testing.** Layer wrappers are transparent full-stage divs stacked
in order. They are `pointer-events: none` with blocks re-enabling
`pointer-events: auto`, otherwise the topmost layer masks every block beneath
it. This applies to the editor stage and the player. A modal layer adds a
backdrop that does take pointer events and makes the layers under it `inert`.

**Player hit-testing.** Player block wrappers are `pointer-events: none` unless
the block is a click-trigger source; native controls (button, input, video...)
inside any block re-enable themselves.

## Other docs
- [CHANGELOG.md](CHANGELOG.md) - every release
- [ROADMAP.md](ROADMAP.md) - planned work, starting with opening and saving Storyline `.story` files
- [AUDIT.md](AUDIT.md) - the November 2026 review by an instructional designer and a Storyline engineer, with status
