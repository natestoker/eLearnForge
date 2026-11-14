# eLearnForge audit, Nov 2026

Two reviewers: an instructional designer who builds compliance and training courses and has to get them through an LMS, and a Storyline engineer who lives in triggers, variables, states and layers. I ran the editor, clicked through the demo course, and read the tracking, engine and runtime code. Type-check is clean and there were no console errors on load.

Not done: I didn't publish a package into a real LMS (SCORM Cloud) this pass, so the SCORM notes below come from reading code, not from a live run.

## What's strong

- Timeline: per-layer timelines, cue points, trim handles, scrubbing with audio. Better than Rise, close to Storyline.
- Trigger conditions: AND/OR, block-state conditions, 13 operators. More than most first-version authoring tools have.
- PPTX import with fonts, themes, animations and links is a real differentiator.
- Output is one offline file, and that's still true. No server, no account.
- The runtime has keyboard focus on interactive blocks and a reduced-motion rule.

## Fix in code (ordered by how much it hurts)

### 1. Scoring and pass/fail is the biggest gap (both personas)
- SCORM 2004 hardcodes pass at 80 (`src/tracking/scorm2004.ts:78`). SCORM 1.2 never writes passed/failed at all. There's no passing-score setting anywhere.
- Completion is "all slides viewed" or an explicit trigger. There's no "completed AND passed" rule, which is what most LMS compliance courses require.
- `setScore` takes a hand-typed number. There's no quiz model: no question bank, no results slide, no attempts limit, no "score = % correct across these questions." Authors have to wire variables by hand.
- Fix: add a Course settings block (pass mark, completion rule, attempts) and a Results object that reads the score. Feed the pass mark into both SCORM adapters and set `cmi.core.lesson_mastery_score` / `cmi.scaled_passing_score`.

### 2. Interaction reporting is thin and slightly wrong (DONE, v6.13; not yet checked in a live LMS/LRS)
- Every interaction is reported as `type: choice` (`scorm12.ts:73`), including matching, drag-drop, fill-in-blank. LMS reports will show the wrong type.
- A retry appends a new `cmi.interactions.n` entry each time, so one question can show up three times in the report.
- Matching never calls `reportInteraction`, so those answers don't reach the LMS. MC, fill-blank, drag-drop, sequence and scenario do.
- Fix: carry an interaction type on the event (choice, matching, fill-in, performance), reuse the index per block id, add `latency`, `timestamp`, `correct_responses`.

### 3. Resume loses state
- If suspend_data goes over 4000 characters, variables are dropped first (`adapter.ts:35`). A course with a score variable and a few flags can silently lose the score on resume.
- Fix: compress the state (short keys, only non-default values; the README says that's done, but verify against a big course) and warn at publish time when a course is likely to overflow.

### 4. Storyline-engineer trigger gaps
Missing against Storyline: keyboard-key events, "when timeline starts", "when variable = X" on a layer, Execute JavaScript as a trigger action (there is a Code block, but not a trigger action), Exit course, Reset-to-initial-state, jump to previous/next/restart slide as actions, lightbox slide, and text-variable input via actions (set to "text").
- Biggest ones to add first: Execute JavaScript, Exit course, Reset to initial state, Previous/Next slide actions, key-press event.
- Triggers panel is too cramped to author in (see design section), which makes everything above feel worse.

### 5. Accessibility in the player
- No `aria-label`, role or live-region on the Multiple choice, Matching or Drag-and-drop runtimes. Feedback ("Correct!") isn't announced to screen readers.
- Modal has Escape-to-close but no focus trap or focus return.
- Drag-and-drop and Matching need a keyboard path (select item, then select target).
- Slide changes don't move focus or announce the new slide title.
- Alt text exists as a field; there's no publish-time check that flags images with empty alt.
- A Section 508/WCAG check in the Publish dialog would be an easy win for the training crowd.

### 6. Authoring hygiene a designer expects
- No review/QA pass. Add a "Publish checks" step: orphan variables, triggers pointing at deleted blocks, slides with no way forward, missing alt text, media over a size threshold.
- Embedded media is stored as data URLs. There's no size warning, so a few narration clips and a video can push the project and the SCORM zip past what an LMS will accept or IndexedDB will hold. Show a size meter and warn at publish.
- Auto-generated variable names like `mc_blk_nhuf5di8xm_correct` are unreadable in the Variables panel. Derive them from the block's Name field.
- Welcome modal reappears on every load; remember dismissal.
- Tests: the repo has no test directory and no `test` script, though the project notes mention Playwright suites. Either those live elsewhere and should be committed, or they're gone. CI only builds and deploys.

### 7. Cleanup in the repo root
- `new_stitch.html`, `stitch_screen.html`, `fetch.cjs`, `extract_icons.cjs`, `icons.json` look like leftover design/scratch files. Both PPTX files are test fixtures and could move to a `fixtures/` folder.
- `dist/` is committed. Fine if Pages needs it, otherwise it's 1.9 MB of churn per commit.
- `README.md` is 1,200 lines of release notes. Split into a short README plus `CHANGELOG.md`.

## Send to Claude Design

These are visual and layout problems, with no logic change needed. Screenshots are in the scratchpad shots folder.

1. **Right-hand panel is too narrow for triggers.** The event, source and action dropdowns truncate to "When blo", "Go to slid", "Pulse". A trigger should read as a sentence ("When Start button is clicked, go to slide 2"), not three clipped selects. Ask for a sentence-style row, or a wider resizable panel with a stacked layout.
2. **Ribbon has dead space and unclear grouping.** Triggers and Variables tabs show a one-line message in a 130px tall bar. Home tab mixes theme colors, grid settings and course settings. Ask for a tighter ribbon with clear group labels, and cut the tall empty tabs.
3. **Dark-on-dark contrast.** Section labels (COURSE THEME, SLIDES, LAYERS), the grey helper text, and the disabled undo/redo sit near unreadable. Ask for a contrast pass to WCAG AA on the editor chrome.
4. **Layers panel.** The base layer name is truncated to "Bas...", the icons (o, lock, pencil) have no labels, and rows are crowded. Ask for a clearer layer row.
5. **Timeline header.** Length, Zoom, snap, lock-all and a long hint sentence collide and wrap ("Length (s)" splits across two lines). Ask for a cleaner toolbar and move the hint to a tooltip.
6. **Publish dialog is sparse.** Just a target dropdown and a completion dropdown. If we add pass mark, attempts and publish checks it needs a real layout: tabs or steps, a checks list, a size summary.
7. **Player chrome.** Not reviewed in this pass; worth a look at the bottom bar, the menu drawer, and the Resources and Glossary panels at phone width, since learners use phones even if authors don't.
8. **Welcome modal.** Works, but the four cards are text heavy. Lower priority.
9. **Icon set.** Mix of emoji (eye, lock) and SVG across the layers and timeline. Ask for one consistent icon family.

Suggested Claude Design prompt: *"Redesign the right-hand Triggers panel and the Publish dialog of a dark-theme eLearning authoring tool. Keep the mint accent (#3dd97a). Triggers should read as sentences with chips, not truncated dropdowns. Publish should have target, completion rule, pass mark, attempts, and a pre-publish checks list with pass/warn states. Meet WCAG AA contrast."* Attach `11-Triggers.png` and `12-publish.png`.

## Suggested order

1. Scoring model and pass/fail (item 1) plus interaction reporting (item 2). Highest value, mostly in `src/tracking`.
2. Publish checks and size meter (items 6, 3).
3. Missing trigger actions (item 4).
4. Player accessibility (item 5).
5. Send the design list to Claude Design in parallel with 1 and 2, then re-apply.
6. Repo cleanup (item 7) whenever.
