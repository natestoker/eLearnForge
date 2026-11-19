---
name: story-file-writing
description: "Use when generating a NEW Articulate Storyline 360 .story file by script, or adding new slides, shapes, pictures, layers, triggers, variables or quiz questions to one (as opposed to editing text in an existing file, which is story-file-internals). Covers the rules Storyline enforces silently and answers with 'invalid or corrupt' or 'assets unreadable': zip layout, GUID-derived part names, media registration, layer and state layouts, trigger XML, freeform Pick One / Pick Many / Drag and Drop questions, font scaling with slide width, autofit, whole-number text margins, backgrounds, and the test-ladder method for finding a rejected attribute. Trigger on 'write a .story', 'export to Storyline', 'build a Storyline file', 'Save as Storyline', 'convert to .story', 'Storyline says invalid or corrupt'."
---

# Writing a `.story` file from scratch

Everything here was confirmed by having a person open generated files in
Storyline 360 (3.129 and 3.130). Storyline gives no detail when it rejects a
file, so each rule below cost a round trip. Read `story-file-internals` first
for the layout of the package and the meaning of the slide XML.

A working implementation is in the eLearnForge repo:
`src/publish/storyExport.ts` (write), `src/publish/storyImport.ts` (read),
`src/publish/storyQuizTemplates.ts` (question objects), `src/publish/md5.ts`.

## Start from a real file

Never write masters, theme, player or content types yourself. Take a blank
project saved by Storyline (the "shell"), keep everything in it, and replace
only its slide. Masters, layouts, the feedback master and `playerProps` come
along for free. Scrub author names from `docProps` before bundling a shell.

Read these ids out of the shell instead of hard-coding them from another file:

- the slide's `layoutG` (matches a layout's `internalG`);
- a Blank layout on the **Feedback master**, used by every layer;
- the Question layout, used by a slide that holds a question.

## Rules that make a file open at all

1. **No directory entries in the zip.** Only files. With JSZip pass
   `createFolders: false` to every `file()` call.
2. **XML parts start with a UTF-8 BOM** and the declaration Storyline uses.
3. **Slide file names** are `slide.xml`, `slide2.xml` ... with a hex suffix
   (`slidea.xml` is the tenth). Order comes from `<sldIdLst>` and the rels, not
   the names.
4. **Part ids come from the GUID.** `id = 'R' + base62(Data1 | Data2<<32 | Data3<<48)`
   with the alphabet `0-9A-Za-z`, where Data1..3 are the first three groups of
   the GUID read as hex. A slide's rel id is `partId(slide g)`. A picture's
   **file name** is `partId(asset g) + extension`. Anything else gives
   "assets unreadable".
5. **Media is listed twice**: in `story.xml` `<mediaLst><mediaLst>` and in
   `story/theme/theme.xml` `<assetLst><mediaLst>`. Each entry has
   `<langAltText />` before `<md5Checksum><stream>..</stream><source>..</source>`
   with the MD5 of the file bytes (Web Crypto has no MD5; bring your own).
   The slide gets a `story/slides/_rels/slideN.xml.rels` with `Type="media"`.
6. **Every `[Content_Types].xml` override and rel** for a new slide must exist.
7. **Text margins are whole numbers.** A decimal in `<textMargin>` makes the
   whole file "invalid or corrupt". `<bounds>` and `<loc>` may have decimals.
8. **A wipe entrance needs `dir="none"`** as well as `wd`.

## Child order

Slide: `tmProps, tmCtxLst, sz, bg, shapeLst, trigLst, localizedName, trans,
note, navData, sldLayerLst, thumb, localizedNote, panTime, panRect`.

Layer (`sldLayer` / `feedBackLayer`): attributes `resetMode="auto"
seek="auto"`, the Feedback-master Blank `layoutG`, then children ending
`... shapeLst, trigLst, localizedName, trans, thumbProv`. The list is
`<sldLayerLst nextIdx="0">`.

Copy a shape's child order from a real shape of the same tag. The order
differs between `textBox`, `pic`, `rect`, `clkAreaRect` and so on.

## Text

- **Font size scales with the slide.** A point size is defined on a 960-wide
  slide: `px = pt * 4/3 * slideWidth/960`. Writing: `pt = px * 0.75 * 960/slideWidth`.
  Get this wrong and text on a 1920 slide is twice the intended size.
- **Paragraph breaks.** The last `Span` of every Block except the final one
  ends in a line feed (`&#xA;` inside the escaped document). Without it the
  paragraphs run together. When reading, drop that trailing line feed.
- **Line spacing.** `LineSpacingRule="Multiple" LineSpacing="20"` is single.
  For other spacing use `LineSpacingRule="AtLeast"` with the full line height
  in points (same scaling as the font): 14pt text at 1.2 is `16.8`.
- The `<text>` element holds an XML document escaped as text. It must parse
  on its own after unescaping.

## Autofit

`autoFit="resize"` is "Expand height": Storyline sizes the shape to its text
plus margins the first time it is touched, so a box drawn taller than its text
collapses. `autoFit="none"` keeps the size, but text that overflows shows a
scrollbar.

What works:

- Text fits the drawn box with about 10% to spare: `none`.
- Text would not fit: `resize`.
- Text holds a `%variable%` reference: always `none` (the placeholder is
  longer than the value).
- Generated rows (choices, drag items, buttons): `none`, and make each row as
  tall as its measured text. Step the font down if the stack will not fit.

Do not try to hold a height by padding the margins. It depends on predicting
Storyline's text height exactly and fails wherever a line wraps differently.
Measure text with the real font; a machine without Segoe UI over-estimates
width.

## Pictures and backgrounds

- `<pic>` with `assetG`, PNG bytes in `story/media/<partId>.png`.
- A slide `<bg><solidFill>` is ignored for display. To carry a background
  (colour, gradient or image), draw it at slide size and add it as a full-slide
  picture at the back of the base layer. A flat colour needs only a few pixels;
  the picture is stretched.

## Variables

`<var g verG name dataType="bool|num|text" val type="user" propPath=""
isRandom="false" randomMin="0" randomMax="0" defaultEmptyIfZero="false" />`
inside `<varLst>`. Names: letters, digits, underscore.

A value shows wherever its name sits between percent signs. Built-ins worth
using: `Project.SlideNumber`, `Project.TotalSlides`, `Project.SlidesViewed`,
`Project.Progress`, `Project.SlideTitle`. There is no built-in score without a
result slide: add a `Score` number and an `OnStart` `adjustVar` (`op="add"`)
trigger on each question's Correct layer.

## Triggers

One `<trig>` with a `<data event action actSubType NavigationIntent
NavigationState>` and a fixed set of children (`keyPress, slide, scene, shape,
clickLst, sldLayer, video, audio, other, ...`). Copy the full element from a
real trigger and change only these:

| What | Form |
| --- | --- |
| Jump | `action="jumpToSlide"`, `actSubType="next" / "prev"`, or `"spec"` with `<slide jumpG="..."/>` |
| Show layer | `action="showSubSlide"`, `<sldLayer showG="layer g"/>` |
| Hide layer | `action="hideSubSlide"`, `showG` and `hideG` |
| Lightbox | `action="LightboxSlide"`, `lightBoxG` |
| Variable | `action="adjustVar"`, `<other varG op="ass|add" boolVal / dblVal / varVal1>` |
| State | `action="changeShapeState"`, `<shape setStateG setStateName>` |
| JavaScript | `action="executeJavaScript"`, `<other js="...">` (newlines as `&#xA;`) |
| URL | `action="jumpToFileUrl"`, `<other open="..."><browserOptions action="new" .../>` |
| Submit | `action="submitInteraction"`, `<interaction submitG="question g"/>` |
| Complete | `action="CompleteCourse"` |

Events: `OnClick`, `OnStart`, `OnEnd`, `OnAnimationComplete`, `OnMouseHover`,
`OnKeyPress` (`keys="Right"`, letters upper case), `OnVariableValueChange`
(`varChangeG`), `OnNextButtonClick`, `OnStateChange`, `OnDrop`.

The Previous button is a slide-level `OnClick` with
`NavigationIntent="Previous"`; Next is `OnNextButtonClick` with
`NavigationIntent="Next"`.

Conditions: `<trigCond op="eq|lt|gt|gte" varG ...>`. A true boolean is
`boolVal="True"` with `floatVal1="0"`.

Anything with no Storyline equivalent goes in an Execute JavaScript trigger as
a commented note, and into a report for the author.

## States

Each state is a shape in `<stateLst>` using the fixed state layout
`layoutG="7f817a98-1fec-49af-97a0-9a010cd18ba4"`; `defG` is the inner shape's
g. Give Normal, Hover and Selected the same box size and margins.

## Freeform questions

A freeform question lives entirely on its slide:

- slide `layoutType="Quiz Questions"` and the Question `layoutG`;
- ordinary shapes for the choices and a Submit button whose trigger is
  `submitInteraction`;
- one invisible question object: `freePickOneIntr`, `freePickManyIntr` or
  `dragDropIntr`. Copy it whole from a real file and swap ids; it carries
  dozens of attributes;
- `<choices><intrFreeChoice shpG matchShpG ...><scoringData correct>`;
  for drag and drop `shpG` is the drag item and `matchShpG` its target;
- `<order>` lists the drag items;
- two `feedBackLayer`s referenced by `corFbG` and `incFbG`;
- `attempts="one"` or `"two"`.

One question per slide. A hotspot is `clkAreaRect`.

## The ladder method

When a file is rejected, do not guess. Build a ladder: a set of small files,
each adding one feature to the last one known to open (empty slide, two
slides, one text box, a picture, a layer, a trigger ...). The person opens
them in order; the first failure names the feature. Keep every rung that
opened as the new baseline.

Before sending any rung, run `scripts/compare_story.py` against unzipped real
files. It flags attributes, values, decimals and child orders never seen in a
real file, dangling GUID references, and directory entries in the zip. It
would have caught the decimal text margins.

```bash
python3 -I scripts/compare_story.py --real real1 real2 --made "T1 - text.story"
```

More real files mean fewer false alarms. Keep client files out of the repo.

## Audio

Confirmed in Storyline 3.130, with and without captions.

- `story.xml` and `theme.xml` media lists: an `<audio type="Mp3">` entry with
  `<langAltText />`, the MD5, and `<props valid="true" file bytes channels="1"
  samples bits sampleCnt startPt="78" mp3="false" origFile>`. The props
  describe a mono 16-bit WAV: `bits = sampleCnt * 2`, `bytes = bits + 78`.
  The WAV file itself does not need to exist.
- With captions: a `<media type="Vtt">` entry (no `<langAltText />`) listed
  before the clip, and on the clip `ClosedCaptionsAssetGuid="vtt g"
  hasClosedCaptions="true"`. Without: `hasClosedCaptions="false"` and no
  guid attribute.
- Files are named by part id as usual (`.mp3`, `.vtt`); content types need
  `mp3` (`audio/mp3`) and `vtt` (`text/vtt`); the slide rels list the MP3
  once and the VTT twice.
- On the slide: `<sound assetG state="106503" id="1" name="Audio">` with
  `<sndTmCtx start dur audioStart="0">` in a `tmCtxLst version="1"`, `<loc>`
  at `-38, h-29` to `-8, h`, and `<sndProps volume="50" ... ccG>` (the VTT's
  g, or zeros). Works on layers too.
- Raise the slide's `tmProps min` to cover start plus duration.

## Not solved yet

Video objects, fill-in-the-blank, sliders, result slides, and the
built-in form question types have not been written and confirmed.
