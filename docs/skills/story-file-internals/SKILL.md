---
name: "story-file-internals"
description: "Use whenever reading, diagnosing, or programmatically modifying an Articulate Storyline 360 `.story` file at the XML level (the file is an OPC/ZIP package): slide titles, notes, variables, layers, timing, animation, text sizes, media lookup, quiz questions. For building new slides, shapes or questions, also read story-file-writing."
---

# `.story` File Internals — Format & Safe-Edit Reference

A `.story` file is an **OPC/ZIP package of XML** (same container family as OOXML). You can unzip it, edit the XML, and re-zip it — but only some edits are safe to do by hand. This skill is the map of what lives where and which edits are safe.

Verified against real client files (e.g. build `3.120.37241.0`, and an 83-slide clinical course).

To create new slides, shapes, pictures, triggers or questions, use the `story-file-writing` skill; it holds the rules Storyline enforces when a file is built from scratch.

---

## The one safety rule that matters

**Content edits (titles, notes, caption text) are safe to do programmatically. Player/behavior settings are NOT — change those in the Storyline UI and republish.**

- Renaming slides, writing notes, injecting caption text = edit the slide XML, re-zip. Fine.
- Anything in `playerProps.xml` (browser sizing, new-window, menu behavior) = do **not** hand-edit the binary/package for delivery. Make the change in the Storyline authoring UI and republish the SCORM/Web output. Hand-edited player settings are how you ship a subtly broken course.

---

## Internal layout

```
<story>.story  (ZIP)
├── story/
│   ├── story.xml              # main player + project config (~47 KB, mostly player config)
│   ├── slides/
│   │   ├── slide1.xml         # one file per slide
│   │   ├── slide2.xml
│   │   └── ...
│   └── ... (media, thumbnails, etc. stored separately)
└── (OPC housekeeping)
```

Slides are organized into **scenes** (scenes are often named — e.g. by researcher, module, or topic).

**Slide order** comes from `story/_rels/story.xml.rels` (the order of `Target="/story/slides/..."` entries, same as `<sldIdLst>` in story.xml). Slide filenames use **hex** suffixes: `slide.xml` is slide 1, then `slide2`..`slide9`, `slidea`..`slidef` (10-15), `slide10` (16), `slide11` (17). Never derive order from filenames.

Media files in `story/media/` are referenced per slide from `story/slides/_rels/slideN.xml.rels` (`Type="media"`).

---

## Slide XML: titles and notes

**Title** = the `name` attribute on the `<sld>` node in `story/slides/slideN.xml`. A blank `name` renders as "Untitled Slide" in the Storyline UI. To batch-rename: read `name`, skip slides that already carry a real title, derive a new short title, write it back.

**Notes** = a `<note>` element whose content is **HTML-escaped rich-text XML** with this hierarchy:

```
<note><Document><Content><Block><Span Text="..."/></Block></Content></Document></note>
```

To read notes, unescape and walk `Document > Content > Block > Span[@Text]`. To write notes (e.g. dumping caption cue text into the notes panel), build that same escaped structure.

**Title-generation strategy** when notes are sparse: notes first, on-screen slide text as fallback, skip only slides that are truly empty. In one real file, 67 of 83 slides were blank-titled but only 5 had any notes — so a notes-only pass barely moves the needle; the hybrid (notes → visible text → skip) is usually the right call. Confirm the approach with the user before writing back.

---

## `playerProps.xml`: the "launches in an external window" bug

Classic symptom: a SCORM course **pops out into a separate browser window instead of staying embedded in the LMS iframe**. Root cause is three player settings acting together:

```
browsersize="Optimal"     playersize="Locked"
newwindow="true"          allowresize="false"
```

Mechanism: Storyline tries to resize the browser to an "optimal" size on launch; browsers block scripts from resizing an existing LMS iframe/tab for security, so Storyline spawns a **new external window** to get the size it wants.

**Fix (in the UI, then republish):** Player → Other → Browser Settings → change *"Resize the browser to optimal size"* to *"Display at user's current browser size."* Also worth a slide scan for any "Jump to URL" triggers set to open in a new window.

---

## Variables in XML

Project variables carry explicit metadata you can trust:

- `type="builtIn"` vs `type="user"` — the authoritative user/system flag (unlike the runtime, where every model just says `kind="variable"`).
- Built-ins live in **dot-separated namespaces**: `Player.` `Project.` `Slide.` `Scene.` `Menu.` `MenuSection.` `Question.`.
- `dataType` is `bool` / `number` / `string`.

This XML is the **ground truth** for validating any runtime variable classifier (see the `seekbar-restorer` skill). One file had 52 variables: 15 user, 37 built-in.

---

## Layers, timelines, and SeekTimeline

- Each **layer has its own independent timeline and `duration`** — a 17.5 s layer can sit inside an 11.8 s base slide. Don't assume layer time tracks slide time.
- The **`SeekTimeline` trigger schema** in the authoring XML confirms the runtime supports **layer-targeted** seeking — relevant when building seek tooling on top of published output.

---

## Audio & captions (and a grep trap)

- **Most `<audio />` tags are trigger-action stubs, not media.** Every trigger's `<data>` block carries empty `<video />` and `<audio />` placeholders, so a slide with zero narration still shows 2-3 `<audio />` tags. Counting them tells you nothing about whether the slide has narration; check the slide's `.rels` for `.mp3`/`.m4a`/`.wav` targets instead.
- **Inserting new audio is not a verified safe edit.** An audio object is a full slide object (GUIDs, timeline context, slide `tmProps min` duration in ms), not a filled-in `<audio>` tag. Never hand-craft one. To inject audio, first get a .story that already contains narration and clone its structure, then have the user open the result to confirm before trusting it.
- **Video object reference:** a video has `<movie dur="22434" fps="30"><sz w="1280" h="720" /></movie>` plus a `<vidTmCtx ... start="0" dur="22434" untilEnd="true" />` timeline context; durations are milliseconds. Slide timeline length is `<tmProps ... min="5000" />`.
- `<audio>` nodes are **empty / self-closing when a slide has no audio or no captions**. If every `<audio>` is self-closed and `story.xml` shows `defaultGenerateCC="false"`, there are **no captions in the file** — stop and tell the user before building a caption-extraction script that will find nothing.
- **`subtitle` is a false positive.** It appears in slide XML as a PowerPoint-style placeholder *type* attribute, not a caption. Grepping for "subtitle"/"caption" will mislead you; captions, when present, live as caption-track data on `<audio>` nodes.

---

## Animation, groups, paragraphs, navigation (verified Nov 2026)

**Entrance effects** live in each object's last `<animEffect><entr>...</entr></animEffect>` (skip the `<stateLst>` copies). All take `dur="PT0.75S" lvl="none" easingDir="none" easingType="lin"`:
`fade dir="none"` | `growShrink` (Grow) | `fly dir="b" easingDir="out" easingType="cubic"` | `float dir="asc"` (Float In up) | `split sd="vertIn"` | `wipe wd="b|t|l|r"` (wipe FROM that side) | `shpMask maskDir="in" mask="circle"` | `wheel amt="one"` | `random rbDir="horz"` | `spin amt="full" sd="clock"` | `spinGrow` | `growTurn` | `zoom vp="shp"` (no dir) | `swivel` | `bounce` (no dir). No entrance = `<animEffect />`.

**Object timing**: `<tmCtx start dur untilEnd>` (ms) inside `<tmCtxLst version="2">`. Group children carry their own tmCtx and Storyline runs on the CHILDREN's times; always time children with the group.

**By Paragraph**: fade `lvl="txt1"` with child `<animationGenerationData>{"duration":"00:00:00.7500000","level":2,"easingDir":0,"easingType":4,"animationGenerationData":null,"direction":0}</animationGenerationData>`, plus the text box's `<parLst>` gets one `<p start end>` per paragraph (character offsets into the plain text, newline counted), listed last paragraph first, each with `<tmProps>`, `<tmCtxLst version="2"><paraTmCtx start dur untilEnd="true" tmStartCustom="false" .../></tmCtxLst>`, `<text>` and `<fmtText>` (the paragraph's Block at 2x margins/spacing/font size, single line spacing, plus an empty Block except on the last). Storyline auto-syncs paragraph starts to the VO when you switch to By Paragraph in the UI.

**Groups**: `<group ... name zOrder><tmProps/><tmCtxLst/><childLst><g>childG</g>...</childLst><trigLst /><stateLst /><bG>...</bG><sldSz/><loc/><animEffect/>...</group>`. Children stay in the slide list (before the group) with `parentG="<group g>"` after `acc`, zOrder 0..n inside the group, and `<animEffect />`. A group's `<loc>` is the union of its children's UNrotated locs; measure rotated children yourself.

**Slide object order**: the base `<shapeLst>` order is the timeline order (bottom to top). Top-level `zOrder` = rank in that list. Reordering is safe if overlapping objects keep their relative order.

**Navigation**: slide `<navData prev prevGesture next nextGesture seek ...>` turns player buttons on/off per slide. Next button trigger: `event="OnNextButtonClick" action="jumpToSlide" actSubType="next"` with `<slide showNav="false" />` (relative; stops at scene ends). Explicit jumps use `actSubType="spec"` and `<slide jumpG="<target sld g>" .../>`. Scenes: story.xml `<scene sceneType="scene"><sldIdLst><sldId>...` in order.

**Masters**: slideLayouts/slideMasters hold literal text from PowerPoint such as the slide-number field (shows as `<#>` in Storyline). Find a slide's layout by its `layoutG` (matches a layout file's content, not always the first g).

**Text box layout attrs**: `vertAlign="m"`, `autoFit="none"` (fixed size), last `<loc>` = position, `<bounds>` inside = text frame.

## Sizes, media and questions (verified Nov 2026, Storyline 3.129 / 3.130)

**Font sizes scale with slide width.** `FontSize` is in points defined on a 960-wide slide: `px = pt * 4/3 * slideWidth/960`. On a 1920 slide, 14pt renders at about 37px. Slide size is `story.xml` `<prop id="15"><sz w h/>`. Any font audit or resize that ignores this is wrong by the scale factor.

**Autofit**: `autoFit="resize"` is "Expand height" (shape snaps to its text plus margins when touched); `"none"` is fixed. `<textMargin>` values are always whole numbers, and `-1` means the default. Writing a decimal there makes the file "invalid or corrupt".

**Line spacing**: `LineSpacingRule="Multiple" LineSpacing="20"` is single (twentieths). `"AtLeast"` carries the full line height in points.

**Paragraphs**: each Block's last Span ends in a line feed, except in the final Block. It is the paragraph break, not an extra blank line.

**Part names**: a slide's rel id and a media file's name are derived from its GUID: `'R' + base62(Data1 | Data2<<32 | Data3<<48)`, alphabet `0-9A-Za-z`. To find a picture's file, either compute that from the asset `g` or match the `<md5Checksum>` in `story.xml` `<mediaLst>` against the MD5 of each file in `story/media/`.

**Masters and layouts**: a slide's `layoutG` matches a layout's `internalG`. Locked artwork on the layout and its master shows on the slide. Theme colours are in the master's `clrLst`, theme fonts in `<fonts major minor>` (`+major` / `+minor` in a Span's `FontFamily`).

**Layers**: `sldLayer` for ordinary layers, `feedBackLayer` for a question's Correct / Incorrect / Try again layers. A layer set to Hidden at start and a base-layer object with `initState="Hidden"` are different things.

**Freeform questions** sit entirely on the slide: `layoutType="Quiz Questions"`, an invisible `freePickOneIntr` / `freePickManyIntr` / `dragDropIntr` object, `<choices><intrFreeChoice shpG matchShpG><scoringData correct>`, feedback through `corFbG` / `incFbG`, and a `submitInteraction` trigger. `shpG` is the choice (or drag item), `matchShpG` the drop target. Built-in form questions (the ones made in Form view) are stored differently and are not mapped here.

**Slide background**: `<bg>` on the slide normally holds only defaults; real backgrounds come from the master or from a full-slide shape or picture on the base layer.

## Workflow & inspection tips

1. Copy the read-only upload to a writable dir, then `unzip`.
2. Inspect before editing. `grep -lio '<tagname'` across all slide XMLs at once is an efficient way to discover which tags/attributes actually exist without opening files one by one.
3. Edit the XML (Python is convenient for unescape/reescape of the note rich-text).
4. Re-zip preserving the package structure.
5. For player-behavior problems, stop and route the fix to the Storyline UI instead.