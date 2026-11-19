# Plan: remaining Storyline work, SCORM Cloud, screen readers

Written 16 November 2026, after v6.37. Order is by how much each item matters
to a real course, not by difficulty.

## Status, 19 November 2026

- **Done:** SCORM Cloud (v6.38). Open Storyline: all the question types in
  Part 2 and result slides (v6.40). Screen reader checklist written
  (`docs/screen-reader-checklist.md`).
- **Waiting on a Storyline check:** audio export (v6.39), test files Y1 to Y5.
- **Still open:** Part 1 items 2 to 7 (result slide, fill-in, video,
  flashcards, scenario, slider on export), the NVDA pass itself, and on
  import: points per question, attempt limits, Review and Reset Quiz.

## Before starting

Three things only Nate can supply. Without them the matching section stalls.

1. **Sample files.** Re-upload `questions.story` and the Arcade quiz template
   if the session is new (the working copies are in a scratch folder that does
   not survive). For audio, one small `.story` with a narrated slide and one
   with a video. A two-slide file made for the purpose is better than a client
   course.
2. **SCORM Cloud login.** An app ID and secret key, entered through the secure
   form when asked. Never pasted in chat.
3. **About 30 minutes at a Windows machine** for the screen reader pass, and a
   Mac or iPhone if VoiceOver is in scope.

## Part 1: Save as Storyline, what is still left out

Each item follows the same loop: find the form in a real file, write it, run
`docs/skills/story-file-writing/scripts/compare_story.py`, send a small test
file, wait for it to be opened in Storyline.

| # | Item | Approach | Risk |
| --- | --- | --- | --- |
| 1 | **Audio** (narration, audio blocks, block audio) | Clone a real audio object: media entry, slide rel, timeline context, slide duration. MP3 goes in as it is. | High. Never written before; the internals skill warns against hand-building it. Expect two or three rounds. |
| 2 | **Result slide** | Clone the Arcade template's result slide and point it at the generated questions. Replaces the stand-in `Score` variable with Storyline's own `Results.ScorePercent`. | Medium. Touches `quizMgr` in `story.xml`. |
| 3 | **Fill in the blank / text entry** | `freeTextEntryIntr` with a text-entry field, from the Arcade file. | Medium. |
| 4 | **Video** | Same shape as audio once item 1 works. | Medium, after 1. |
| 5 | **Flashcards** | No Storyline equivalent. A card shape with a "Flipped" state and a click trigger per card. | Low. Uses forms already confirmed. |
| 6 | **Scenario** | A layer per step, buttons that show the next layer. Same pattern as tabs. | Low. |
| 7 | **Slider** | Find a real slider in a sample first. If none turns up, leave it as an outlined box with a note. | Unknown until a sample exists. |

Stop point: items 1 to 3 are the ones a real course needs. Items 5 and 6 are
quick. Item 7 only if a sample is available.

## Part 2: Open Storyline, what is still not converted

| # | Item | Maps to |
| --- | --- | --- |
| 1 | Freeform drag and drop (`dragDropIntr`) | dragDrop block, or matching when every item has its own target |
| 2 | Fill in / text entry | fillBlank or textEntry block |
| 3 | Hotspot question | hotspot blocks plus right and wrong triggers |
| 4 | Result slide | results block |
| 5 | Built-in form questions (from `questions.story`) | multipleChoice, matching, sequence, fillBlank as fits; the rest stay as a note |
| 6 | Scoring and attempts | question points, attempts, pass mark |

These can be tested here without Storyline: import the sample, play it in the
browser suite, check right and wrong answers reach the correct layer. Only the
round trip (import, save, reopen in Storyline) needs Nate.

## Part 3: SCORM Cloud

**Done 19 November 2026 (v6.38).** Both versions pass; results are at the end
of item 2 in `AUDIT.md`. The steps below are kept for a repeat run.

SCORM was already checked against an independent runtime. This is the check
against the reference LMS.

1. Publish the demo course as SCORM 1.2 and SCORM 2004 4th edition.
2. Upload both through the SCORM Cloud API (the `elearnforge-scorm-cloud`
   environment already allows the hosts).
3. Launch each, then read the registration back and confirm: completion,
   success status, score, session time, and that suspend data resumes on the
   right slide after closing mid-course.
4. Read the debug log for any call SCORM Cloud flags as an error.
5. Fix what turns up, add the result to `AUDIT.md`.

If the API cannot drive the launch from here, fall back to: upload by API,
Nate clicks through once, results read back by API.

## Part 4: NVDA, JAWS, VoiceOver

Orca on Linux has already been through the course. These three cannot run in
the cloud session, so the pass is by hand with a script.

1. Prepare a one-page checklist per screen reader: the published demo course,
   the exact keys to press, and what should be announced at each step (slide
   title on change, button names and states, question and choices, feedback
   layer, lightbox open and close, menu drawer).
2. Nate runs NVDA with Chrome first (free, most common), about 15 minutes, and
   notes any step where the announcement is missing or wrong.
3. Fixes go in, then JAWS and VoiceOver repeat only the steps that touch
   something changed, plus the question slides.
4. Record the versions tested and the result in `AUDIT.md`.

JAWS runs for 40 minutes at a time without a licence, which is enough for the
checklist.

## Suggested order for the day

1. Export audio (Part 1, item 1), since it has the most rounds and waiting.
2. While waiting on Storyline: import items (Part 2), which need no one.
3. SCORM Cloud once the login is entered.
4. Result slide and fill in the blank.
5. Screen reader checklist written; Nate runs NVDA when convenient.
6. Flashcards, scenario, video, slider as time allows.

## Done means

- Each export item opened in Storyline by a person, not only passing tests.
- Each import item covered by a browser test on a synthetic file.
- `docs/storyline-import.md`, the two story skills and `CHANGELOG.md` updated.
- Merged to `main` after confirmation.
