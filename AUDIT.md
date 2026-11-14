# eLearnForge audit, Nov 2026

Two reviewers: an instructional designer who builds compliance and training courses and has to get them through an LMS, and a Storyline engineer who lives in triggers, variables, states and layers. I ran the editor, clicked through the demo course, and read the tracking, engine and runtime code. Type-check is clean and there were no console errors on load.

How it was checked: the editor and demo course were run in a browser, the player was read with a real screen reader (Orca in Epiphany), the published SCORM 1.2 and 2004 output was run against scorm-again (an independent SCORM runtime), and the published packages were uploaded to a real LMS (Moodle 4.5) and played; the xAPI output was sent to a real LRS (Yet Analytics lrsql) and read back. Not checked: SCORM Cloud itself (the network here can't reach it) and the commercial screen readers (NVDA, JAWS, VoiceOver), which need a Windows or Mac machine. See the end of item 2 and item 5.

## What's strong

- Timeline: per-layer timelines, cue points, trim handles, scrubbing with audio. Better than Rise, close to Storyline.
- Trigger conditions: AND/OR, block-state conditions, 13 operators. More than most first-version authoring tools have.
- PPTX import with fonts, themes, animations and links is a real differentiator.
- Output is one offline file, and that's still true. No server, no account.
- The runtime has keyboard focus on interactive blocks and a reduced-motion rule.

## Fix in code (ordered by how much it hurts)

### 1. Scoring and pass/fail is the biggest gap (both personas) (DONE: v6.12 pass mark, completion rules, auto score; v6.15 max attempts; v6.16 Results block; v6.17 question banks)
- SCORM 2004 hardcodes pass at 80 (`src/tracking/scorm2004.ts:78`). SCORM 1.2 never writes passed/failed at all. There's no passing-score setting anywhere.
- Completion is "all slides viewed" or an explicit trigger. There's no "completed AND passed" rule, which is what most LMS compliance courses require.
- `setScore` takes a hand-typed number. There's no quiz model: no question bank, no results slide, no attempts limit, no "score = % correct across these questions." Authors have to wire variables by hand.
- Fix: add a Course settings block (pass mark, completion rule, attempts) and a Results object that reads the score. Feed the pass mark into both SCORM adapters and set `cmi.core.lesson_mastery_score` / `cmi.scaled_passing_score`.

### 2. Interaction reporting is thin and slightly wrong (DONE, v6.13; checked against scorm-again and a real LRS in v6.19)
- Every interaction is reported as `type: choice` (`scorm12.ts:73`), including matching, drag-drop, fill-in-blank. LMS reports will show the wrong type.
- A retry appends a new `cmi.interactions.n` entry each time, so one question can show up three times in the report.
- Matching never calls `reportInteraction`, so those answers don't reach the LMS. MC, fill-blank, drag-drop, sequence and scenario do.
- Fix: carry an interaction type on the event (choice, matching, fill-in, performance), reuse the index per block id, add `latency`, `timestamp`, `correct_responses`.
- Checked in v6.19. `tests/e2e/scorm-conformance.e2e.mjs` publishes the demo course and runs it against scorm-again for both SCORM 1.2 and 2004. The runtime validates every value the way an LMS does, and rejected none (49 calls on 2004, 42 on 1.2). One interaction entry is reused on retry, the type is `choice`, the score ends at 50, and the status is right for each version. `tests/e2e/xapi-lrs.e2e.mjs` sends a published xAPI course to a real LRS and reads the statements back: initialized, experienced, answered (wrong then right, `choice`, correct response pattern), scored (scaled 0.5, success against the pass mark), completed. That run also found a real gap: xAPI resume was written to the LRS but only read from the browser's own storage, so a learner opening the course on another device started over. It now reads the LRS State API when there is no local copy, and the suite checks that a fresh browser lands on the saved slide. The xAPI suite needs a running LRS, so it skips unless `XAPI_LRS_ENDPOINT`, `XAPI_LRS_KEY` and `XAPI_LRS_SECRET` are set.
- A real LMS, also v6.19. Moodle 4.5 ran in Docker (`tests/lms-moodle/`, steps in its README). The demo course was published as SCORM 1.2 and 2004, uploaded as SCORM activities and played in a browser: wrong answer, retry, finish. Moodle stored what we sent. For 1.2: `lesson_status` set, one `cmi.interactions_0` entry (type `choice`, correct pattern `0`, result `correct` after the retry, latency), `score.raw` 50 with min 0 and max 100, `lesson_location` 6, and a 50 in the gradebook. For 2004: `completion_status` completed, `success_status` passed, `score.scaled` 0.5, the same single interaction, and `cmi.location` 6. This found one more gap: neither adapter reported time spent, so Moodle's time column would have stayed empty. Both now write `session_time` on exit (Moodle then shows `total_time` 23 seconds on a 23-second session), and the scorm-again suite checks it and the saved resume data. Resume read-back (leaving and re-entering an attempt) was checked with the unit and scorm-again tests, not by re-entering inside Moodle.

### 3. Resume loses state (DONE v6.16: positions stored instead of ids; a 250-slide course went from 11,227 to 2,269 characters. Old saved states still load.)
- If suspend_data goes over 4000 characters, variables are dropped first (`adapter.ts:35`). A course with a score variable and a few flags can silently lose the score on resume.
- Fix: compress the state (short keys, only non-default values; the README says that's done, but verify against a big course) and warn at publish time when a course is likely to overflow.

### 4. Storyline-engineer trigger gaps (DONE v6.14 and v6.16: Execute JavaScript, Exit course, resets, next/prev/restart slide, key press, "when timeline starts". Lightbox: v6.17 adds real lightbox slides (a slide flagged "Use as lightbox", opened with the Open lightbox action; timeline animations play inside it), and v6.16 added modal layers. Set-to-text already existed as Set variable with a string value.)
Missing against Storyline: keyboard-key events, "when timeline starts", "when variable = X" on a layer, Execute JavaScript as a trigger action (there is a Code block, but not a trigger action), Exit course, Reset-to-initial-state, jump to previous/next/restart slide as actions, lightbox slide, and text-variable input via actions (set to "text").
- Biggest ones to add first: Execute JavaScript, Exit course, Reset to initial state, Previous/Next slide actions, key-press event.
- Triggers panel is too cramped to author in (see design section), which makes everything above feel worse.

### 5. Accessibility in the player (DONE v6.16 to v6.19; NVDA, JAWS and VoiceOver still untested)
Done in v6.16: question blocks have groups, radio/checkbox roles and spoken feedback; drag-and-drop has a keyboard path; dialogs trap and return focus; slide changes move focus to a labelled region; Publish checks flag missing alt text and uncaptioned video. v6.17: axe-core (WCAG 2.0/2.1 A and AA plus best practice) finds no violations in the player slides, menu, Resources panel, lightbox, or the editor's Welcome, Triggers and Publish screens. v6.18: Chrome's accessibility events recorded while stepping through a course showed two problems (focus lost after Submit; drag-and-drop Tab order), fixed.

v6.19: a real screen reader. Orca 46 read the published course in Epiphany (WebKitGTK), driven by real keystrokes through xdotool, with Orca's own speech log as the transcript. Chrome never delivered focus events to Orca in this headless setup, which is why Epiphany. The harness is in `tests/screen-reader/` (see its README); it is not in CI because it needs a Linux desktop stack. What Orca said, and what that changed:
- Slide change was silent. Focus went to a hidden heading and a live region, and Orca said nothing. Focus now goes to the `main` landmark, which is labelled "Spot the red flags, slide 2 of 6", and Orca speaks it.
- Quiz feedback was silent after Submit for the same reason. The feedback is now a labelled region that takes focus, and Orca reads "Right - type the address yourself or use a bookmark."
- Hotspots with no name were read as "push button" with nothing else. They now fall back to the block's name, and Publish checks warn about clickable objects with no name.
- Drag and drop: picking up an item now moves focus to the first Place button, and Orca reads "Place in Phishing push button". After placing, focus returns to the item, read as "toggle button not pressed" or "pressed".
- Also confirmed working: the menu button ("Show navigation collapsed" and then "expanded"), the "Course controls" landmark with Play, the seek slider ("12.0 of 12.0 seconds") and Next; radio buttons read as "not selected radio button" and then "selected"; the lightbox opens as "Hint popup dialog" with a Close button and Escape returns focus to "Open hint".
- One thing I could not pin down: in one of the Orca runs the slide 3 change was silent while slides 2, 4 and 5 were spoken. It did not repeat, and I could not reproduce it, so I am recording it instead of calling it fixed.

Not done: NVDA, JAWS or VoiceOver on a real Windows or Mac machine. That needs a person with one of them. Orca on WebKit is a real screen reader, but it is not the same as the ones most learners use.

The original findings, for the record:
- No `aria-label`, role or live-region on the Multiple choice, Matching or Drag-and-drop runtimes. Feedback ("Correct!") isn't announced to screen readers.
- Modal has Escape-to-close but no focus trap or focus return.
- Drag-and-drop and Matching need a keyboard path (select item, then select target).
- Slide changes don't move focus or announce the new slide title.
- Alt text exists as a field; there's no publish-time check that flags images with empty alt.
- A Section 508/WCAG check in the Publish dialog would be an easy win for the training crowd.

### 6. Authoring hygiene a designer expects (publish checks and size meter DONE in v6.15)
- No review/QA pass. Add a "Publish checks" step: orphan variables, triggers pointing at deleted blocks, slides with no way forward, missing alt text, media over a size threshold.
- Embedded media is stored as data URLs. There's no size warning, so a few narration clips and a video can push the project and the SCORM zip past what an LMS will accept or IndexedDB will hold. Show a size meter and warn at publish.
- Auto-generated variable names like `mc_blk_nhuf5di8xm_correct` are unreadable in the Variables panel. DONE v6.16: the name has to stay (the player looks it up by name), so pickers and the Variables panel now show "Knowledge check: correct" and say which block owns it.
- ~~Welcome modal reappears on every load; remember dismissal.~~ False alarm: it already remembers dismissal (`elearnforge.welcomed` in localStorage); it only looked repeated in a fresh test browser. It now also closes on Escape and traps focus.
- Tests: DONE v6.16, v6.18 and v6.19. `tests/` holds 10 unit-test files run by `npm test`, and `tests/e2e/` holds 10 Playwright browser suites run by `npm run test:e2e` (quiz tracking, triggers, publish flow, accessibility with axe-core, banks and lightbox, phone layout, media compression, compress in Publish, SCORM conformance against scorm-again, and xAPI against a real LRS when one is running). CI runs both before deploying.

### 7. Cleanup in the repo root (DONE v6.16)
- Removed `new_stitch.html`, `stitch_screen.html`, `fetch.cjs`, `extract_icons.cjs`, `icons.json` (one-off Stitch download scripts; one held a signed URL and a local Windows path; nothing referenced them). PPTX files moved to `fixtures/`.
- `dist/` stays committed on purpose: the editor is distributed as one file people open from disk. Pages rebuilds it anyway. README now says so.
- README is 89 lines; release notes moved to `CHANGELOG.md`.
- Left alone: `src/assets/icons/*.svg`, which no code imports. Delete them if you don't plan to use them.
- Media compression (the Publish checks' Compress button): DONE v6.18. Images are scaled to 1920px and saved as WebP, audio becomes 96 kbps MP3, video is re-encoded at about 1.5 Mbps (real time, cancellable).

## Send to Claude Design (status: all nine done)

These are visual and layout problems, with no logic change needed. Screenshots are in the scratchpad shots folder.

1. (DONE v6.15) **Right-hand panel is too narrow for triggers.** The event, source and action dropdowns truncate to "When blo", "Go to slid", "Pulse". A trigger should read as a sentence ("When Start button is clicked, go to slide 2"), not three clipped selects. Ask for a sentence-style row, or a wider resizable panel with a stacked layout.
2. (DONE v6.16 and v6.17: Triggers and Variables tabs use a one-line shelf; the Home tab is now Course theme, Transition, Canvas and Course groups with shorter notes.) **Ribbon has dead space and unclear grouping.** Triggers and Variables tabs show a one-line message in a 130px tall bar. Home tab mixes theme colors, grid settings and course settings. Ask for a tighter ribbon with clear group labels, and cut the tall empty tabs.
3. (DONE v6.16: the faint text color went from about 3.4:1 to 5.2:1, the locked-row label from 4.2:1 to 7:1, disabled controls keep 4.5:1 through color instead of opacity. Checked by calculation, not with an automated audit tool.) **Dark-on-dark contrast.** Section labels (COURSE THEME, SLIDES, LAYERS), the grey helper text, and the disabled undo/redo sit near unreadable. Ask for a contrast pass to WCAG AA on the editor chrome.
4. (DONE v6.16) **Layers panel.** The base layer name is truncated to "Bas...", the icons (o, lock, pencil) have no labels, and rows are crowded. Ask for a clearer layer row.
5. (DONE v6.16) **Timeline header.** Length, Zoom, snap, lock-all and a long hint sentence collide and wrap ("Length (s)" splits across two lines). Ask for a cleaner toolbar and move the hint to a tooltip.
6. (DONE v6.15) **Publish dialog is sparse.** Just a target dropdown and a completion dropdown. If we add pass mark, attempts and publish checks it needs a real layout: tabs or steps, a checks list, a size summary.
7. (DONE v6.16 and v6.17: reviewed at 390px wide. The bottom bar was cutting off the seek bar and now wraps into two rows; the menu drawer pushed the slide off-screen and collided with the Resources and Glossary buttons, so on phones it now floats over the slide. Resources and Glossary panels were fine.) **Player chrome.** Not reviewed in this pass; worth a look at the bottom bar, the menu drawer, and the Resources and Glossary panels at phone width, since learners use phones even if authors don't.
8. (DONE v6.17: copy cut to one short line per card.) **Welcome modal.** Works, but the four cards are text heavy. Lower priority.
9. (DONE v6.15 to v6.17: Layers, Timeline, undo/redo, lock buttons, Triggers, Publish, and the Insert and Home ribbons all use Lucide.) **Icon set.** Mix of emoji (eye, lock) and SVG across the layers and timeline. Ask for one consistent icon family.

Suggested Claude Design prompt: *"Redesign the right-hand Triggers panel and the Publish dialog of a dark-theme eLearning authoring tool. Keep the mint accent (#3dd97a). Triggers should read as sentences with chips, not truncated dropdowns. Publish should have target, completion rule, pass mark, attempts, and a pre-publish checks list with pass/warn states. Meet WCAG AA contrast."* Attach `11-Triggers.png` and `12-publish.png`.

## Suggested order

1. Scoring model and pass/fail (item 1) plus interaction reporting (item 2). Highest value, mostly in `src/tracking`.
2. Publish checks and size meter (items 6, 3).
3. Missing trigger actions (item 4).
4. Player accessibility (item 5).
5. Send the design list to Claude Design in parallel with 1 and 2, then re-apply.
6. Repo cleanup (item 7) whenever.
