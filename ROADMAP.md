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

## Next: review site (comments from reviewers, stored in their own Drive or Dropbox)

**Goal.** Let someone review a course without an account on our side: they open a review page, see the course, and leave comments pinned to a slide (or a moment on its timeline). Comments live in the reviewer's own Google Drive or Dropbox, next to the course file, and the author sees them in the editor.

**Why it's feasible.** The output is already one HTML file, and both Drive and Dropbox offer browser sign-in (OAuth with PKCE) that needs no server of ours. Drive and Dropbox won't render a course as a web page themselves, so the review page has to be hosted separately (GitHub Pages works) and read the course through the provider's API.

**Order.**
1. Reviewer mode in the player: comment pins per slide, saved to a JSON file that reviewers export and send back. No accounts, no network. Lets us settle the comment format and how the editor shows comments.
2. Google Drive: sign in with the narrow "files this app opens or creates" scope, load the course from a Drive file, keep comments in a JSON file beside it.
3. Dropbox, the same way.

**Open questions.** Who owns the OAuth app (one we ship, or each team's own) and what the sign-in screen looks like for each; how to merge comments from several reviewers without a server.

## Later: Rust where it earns its keep
Not a rewrite. Two places it would help: compile hot paths to WebAssembly (a faster video encoder for Compress, the `.story` parser), which keeps everything online and in one file; and wrap the existing app in Tauri for a desktop build if `.story` write-back needs real file access. Revisit when we start on `.story` Phase 2.

## Later: combine and subtract shapes
The pen tool edits one path at a time. Union, subtract, intersect and exclude need a path-clipping library (small, but it flattens curves) and a design for compound paths with holes, which the shape block can't hold yet.

## Also queued
`AUDIT.md` has what the November 2026 review found. Everything in it is done. What's left is checking on things I couldn't get at from the build environment. These two were deferred on purpose, to be picked up later:
- Test the player with NVDA, JAWS or VoiceOver on a real machine. Orca, a real screen reader, was run against the published course and found and fixed real problems (see AUDIT.md, item 5), but the three commercial ones need Windows or a Mac.
- Run a package through SCORM Cloud, which wasn't reachable from the build environment. SCORM 1.2 and 2004 were checked against scorm-again and a real LMS (Moodle 4.5), and xAPI against a real LRS (lrsql). Other LMSes (Cornerstone, Docebo, Workday) can still behave differently.

Smaller follow-up:
- Video compression runs in real time (a 3-minute video takes about 3 minutes). A faster encoder would need a WebAssembly build of ffmpeg, which is large.
