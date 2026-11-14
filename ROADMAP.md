# Roadmap

Items here are planned work, ordered by when we expect to pick them up. "Next" means the next thing we start, not a someday list.

## Next: open and save Storyline `.story` projects

**Goal.** Open a Storyline 360 `.story` file in eLearnForge and edit it. Later, write changes back into a `.story` that Storyline opens without complaint.

**Why it matters.** Most of the people we want to reach already have years of courses in Storyline. Today the only way in is PowerPoint import, which drops triggers, layers, states and timelines. A `.story` importer brings the logic across, and write-back makes eLearnForge usable as a second editor on the same file instead of a one-way exit.

**What we know about the format.** A `.story` is a ZIP of XML (same container family as OOXML). Slides are `story/slides/slideN.xml`, with the real order in `story/_rels/story.xml.rels`, not the filenames (they use hex suffixes). Project variables carry reliable `builtIn` / `user` flags. Each layer has its own timeline in milliseconds. Entrance effects, triggers, states, groups and notes are all plain XML we can read. This was verified against Storyline build 3.120 files, including an 83-slide course.

**What we know is risky.**
- It's an undocumented format and can shift between Storyline builds. We've only seen a small number of files.
- Hand-written audio objects are not safe. They're full slide objects with GUIDs and timeline context, so we must clone existing structure rather than invent it.
- `playerProps.xml` and other player settings must never be edited by us. Storyline can ship a subtly broken course from a hand edit.
- eLearnForge's model and Storyline's don't match one to one. Some things will be lossy in each direction.
- We can't verify that Storyline accepts a written file from inside this environment. Someone has to open it in Storyline 360.

### Phase 0: spike (a few days)
- Collect 4 or 5 real `.story` files from different builds and course styles (simple, heavy triggers, lots of layers, narration, drag-and-drop). We have none in the repo today, so this is the blocker.
- Catalog which XML tags and attributes actually occur, then write the mapping table: Storyline object, trigger, state or animation to eLearnForge block, trigger, state or animation, with a "no equivalent" column.
- Decide fidelity targets with real examples side by side.

### Phase 1: open (read-only import)
Same approach as the PPTX importer, and it reuses JSZip, which we already ship.
- Slides in true order, scenes preserved as a grouping, slide names, notes, size.
- Text, shapes, images, video and audio, with media pulled from each slide's `.rels`.
- Groups, z-order, and per-object timing from `tmCtx`.
- Layers with their own timelines.
- User variables (skip built-ins) and the common triggers and actions that have equivalents here.
- Entrance and exit animations mapped to our presets.
- An import report listing everything that wasn't carried over, so nobody is surprised.
- Keep the original package bytes alongside the project, because Phase 2 needs them.

### Phase 2: save back to `.story` (patch, don't regenerate)
Start with the conservative version. Keep the original package untouched and write only edits we know are safe into the XML: slide titles, notes, text content, caption text. Everything we don't understand is carried through byte for byte. Use the File System Access API so Save writes to the same file, with an automatic backup copy.
- Gate it: a banner on projects opened from `.story` says what will and won't be written back.
- Every write-back gets opened in real Storyline before we call it supported.

### Phase 3: wider write-back (research)
Writing new objects, triggers, animations or layers into Storyline XML. Only attempt it per object type, and only after Phase 2 is solid and we have clone-from-example recipes verified in Storyline. Audio stays out until we can clone from a file that already has narration. Full regeneration of a `.story` from an eLearnForge project is the long shot and may never be worth it.

### Needs from you
1. A handful of `.story` files to build against, ideally with client content removed.
2. A call on priority: open first (my recommendation), or push for write-back sooner.
3. How much loss on import is acceptable, for example drag-and-drop or complex trigger chains landing as "needs rebuilding" with a note.

### Done means
- Phase 1: the sample files open, the report is honest, and a Storyline engineer agrees the logic came across.
- Phase 2: a title, notes or text edit made here appears in Storyline after reopening the saved file, and nothing else in the course changed.

## Also queued
See `AUDIT.md` for what the November 2026 review found and what has been done. The review is complete except for two checks that need things this environment doesn't have:
- Test the player with a real screen reader (NVDA or VoiceOver). axe-core and the accessibility tree look clean, but that is not the same as listening to it.
- Run a published package through SCORM Cloud and an LRS. None of the reporting has been checked against a real LMS.

Smaller follow-ups:
- Animations inside lightbox slides (they open as a still view today).
- Media compression from the Publish checks (the design's Compress button).
- Playwright browser suites in the repo, including the axe-core run (the unit tests are in `tests/`).
