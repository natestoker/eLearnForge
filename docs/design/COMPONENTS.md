# Components and where they live

## Editor shell (`src/editor/`)
| Area | File | Notes |
| --- | --- | --- |
| App frame, panel layout | `App.tsx`, `Splitter.tsx` | left rail / canvas / right panel / timeline |
| Top bar | `Toolbar.tsx` | undo/redo, quick-insert, File menu, Preview, Publish |
| Ribbon (4 tabs) | `Ribbon.tsx`, `ribbon/Ribbon{Insert,Format,Animations,View}.tsx` (Format is the Arrange tab), `ribbon/RibbonEmpty.tsx` | 96 px shelf, commands only |
| Slide inspector | `SlideProperties.tsx` | shown in the right panel when nothing is selected |
| Course settings | `CourseSettingsDialog.tsx` | theme, player, resources, glossary, banks |
| Slides panel | `SlidesPanel.tsx`, `SlidePreview.tsx` | real thumbnails, drag to reorder |
| Layers panel | `LayersPanel.tsx` | |
| Canvas | `EditorCanvas.tsx` | pasteboard, handles, guides, marquee |
| Timeline | `TimelinePanel.tsx` | per-layer tracks, cue points, trim handles |
| Block properties | `BlockPanel.tsx` + `blocks/*/Properties.tsx` | Properties / Effects / Animate tabs |
| Triggers | `TriggersPanel.tsx` | sentence rows with chips |
| Variables | `VariablesPanel.tsx` | |
| Publish | `PublishDialog.tsx` | the newest dialog design |
| Other dialogs | `Modal.tsx` + `GlobalSettings.tsx`, `BanksEditor.tsx` | Player Settings, Resources, Glossary, Banks; the old pattern |
| Pen tool | `PenEditor.tsx` | |
| Story view | `StoryView.tsx` | |
| Welcome | `Welcome.tsx` | |
| Field primitives | `fields.tsx`, `LabelStyleFields.tsx` | `Field`, `TextInput`, `NumberInput`, `SelectInput`, `ColorInput`, ... |
| Icons | `lucide.tsx`, `icons.tsx` | `icons.tsx` is the older set |

## Player (`src/runtime/`)
| Area | File |
| --- | --- |
| Player shell, menu drawer, controls, panels | `Player.tsx`, `PlayerChrome.tsx` |
| Lightbox | `Lightbox.tsx` |
| Block effects | `BlockFx.tsx` |

## Blocks (`src/blocks/<name>/{Canvas,Properties,Runtime}.tsx`)
text, image, video, audio, shape, button, hotspot, statement, group,
multipleChoice, matching, fillBlank, sequence, dragDrop, flashcards, scenario,
labeledGraphic, tabs, slider, checklist, timer, progress, varDisplay, results,
code, textEntry.

Each has three faces: how it looks while authoring (`Canvas`), its settings
(`Properties`), and what the learner sees (`Runtime`).
