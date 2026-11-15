# Issues, ranked

Found by going through every screenshot in `screens/` (captured from the real build with `scripts/capture-screens.mjs`). Numbers come from measuring the running editor. "Where" is the file to start in.

This is what I noticed, not a complete list. Treat it as a starting point and review every screen.

## Major

**1. The player is unusable for reading on a phone.** `screens/pl-phone-*.png`
The 16:9 slide is scaled to the screen width (390 px), so a 1280-px-wide slide runs at about 30%. Body text lands around 4 px, quiz options and drag-and-drop labels are unreadable, and roughly 60% of the screen is dead black above and below the slide. Rotating the phone is the only fix a learner has. We need a phone layout for the player: probably a reflowing single-column mode for quiz and text slides, or at least a landscape prompt and much better use of the vertical space. Where: `src/runtime/Player.tsx`, `.player-stage` in `src/styles.css`.

**2. Two dialog designs in one product.** `ed-13-publish.png` vs `ed-12-player-settings.png`, `ed-12-glossary.png`, `ed-12-resources.png`, `ed-12-banks.png`
Publish got the new treatment: grouped sections, cards, a checks list, a size meter. Player Settings, Resources, Glossary and Banks still use the old `Modal`: a bare title, a text "x" instead of an icon, and unlabelled form rows. Player Settings is the worst: about 14 controls in a 310-px box, with checkbox rows followed by bare text inputs ("back [Back]", "next [Next]"), and selects in rows that read as one run-on line ("CHROME Dark BUTTONS Rounded"). The empty states ("No banks yet.") are one grey line. Where: `src/editor/Modal.tsx`, `src/editor/GlobalSettings.tsx` (`PlayerSettingsSection`, `ResourcesEditor`, `GlossaryEditor`), `src/editor/BanksEditor.tsx`.

**3. The ribbon's fixed 128 px shelf can't hold its tabs.** `ed-02-ribbon-format.png`, `ed-01-ribbon-slide.png`
- *Format:* with a block selected, the Size & Position and Align groups are taller than the shelf; the first row is clipped at the top.
- *Slide:* the content is 313 px wider than a 1500-px window (1813 vs 1500). The Nav group is cut off ("BACK BU"), and the only way to reach the rest is a hidden horizontal scroll. The first group's labels are crammed ("LIGHTBOX [x] Use as lightbox  WIDTH").
- *Animations:* the Motion path group's hint is cut mid-word ("Easing, di").
The ribbon is trying to be a Word-style toolbar and many of its tabs are really forms. Where: `.ribbon-body` (128 px, `overflow-x: auto; overflow-y: hidden`) and `ribbon/*.tsx`.

**4. Type is too small in the editor chrome.** every `ed-*` screenshot
Measured in the running editor: 49 text elements at 9 px and 40 at 10 px, against 71 at 12 px. The 9–10 px ones are the mono uppercase micro-labels (ribbon group titles, field labels like "ROTATION", "SCREEN READER", panel subtitles). They pass contrast but are hard to read. The CSS has 18 distinct font sizes in total. See `TOKENS.md`.

## Medium

**5. Timeline shows two rows.** `ed-14-timeline.png`
The strip is about 180 px tall including its header and ruler, so at 900 px high you see "Start button" and "Shield" and have to scroll for the rest. For a course with 10 blocks on a slide it's close to unusable without resizing. Where: `.timeline-panel`, `src/editor/TimelinePanel.tsx`.

**6. Empty ribbon tabs waste the biggest band on screen.** `ed-04-triggers.png`, `ed-05-variables.png`, `ed-02-ribbon-format.png` (nothing selected)
Triggers and Variables show two lines of text in a 128-px band; the real UI is in the right panel. We made every tab the same height to stop the layout jumping, which fixed the jump but left a lot of nothing. Either collapse the ribbon on those tabs and keep the height with the panel, or put real controls in them (add trigger, filters).

**7. Raw HTML textarea for text blocks.** `ed-03-panel-properties.png`
"CONTENT (HTML ALLOWED)" shows `<b>Phishing Awareness</b>` and, after pasting from a PPTX, long inline `style="color:#1fa871"` spans. Authors who aren't developers don't want to edit that. The on-canvas rich-text editor exists; the panel field should probably be hidden behind an "Edit HTML" toggle.

**8. Variable names are shown raw.** `ed-05-variables.png`
`mc_blk_2wt9cqw3ks_correct`, `dd_blk_d5o2h1o3ks_correct`. The hint says the name must stay (the player looks variables up by name), and pickers elsewhere show friendly names, but the Variables list itself is the place people go to understand these. Show the friendly label as the primary text and the technical name as secondary.

**9. The player's own controls are tiny.** `pl-desktop-*.png`
The bottom bar's course/slide caption ("Knowledge check (4/6)") is about 9 px and dim; the Resources and Glossary buttons float over the top-right of the slide and can cover slide content; the disabled Submit button is very faint (`pl-desktop-04-quiz.png`). Check the Submit and Back disabled states against AA.

**10. Thumbnail cards have unlabelled controls.** `ed-15-left-panels.png`
On the selected slide the three little icons (link, square, x) have no labels, and "x" deletes the slide with no obvious confirmation. Where: `src/editor/SlidesPanel.tsx`.

## Minor

**11. Right-panel density.** `ed-03-panel-*.png`, `ed-09b-quiz-props.png`
Property fields are the same weight whether they matter or not (X/Y/W/H/Rotation get as much room as Fill). No grouping or collapsing; a quiz block has dozens of fields in one long scroll.

**12. Welcome dialog.** `ed-00-welcome.png`
The four step cards are all equal weight and none says what to click first; "Made by ..." footer links are 10 px.

**13. Story view is mostly empty.** `ed-11-story-view.png`
Six small cards across the top and about 80% blank. It also clips the sixth card at the right edge.

**14. Pen tool dialog.** `ed-07-pen-tool.png`
Two rows of buttons (generators, then actions) with no grouping; "Apply" wraps to its own line at this width; the point tools sit on the same row as Cancel. The seeded canvas is a solid green square, which reads as a filled rectangle rather than an editable path.

**15. Context and File menus are inconsistent.** `ed-08-file-menu.png`, `ed-10-context-menu.png`
Different row heights, icon sizes and dividers between the two menus.

## What already works (keep it)

- The Insert ribbon after the layout fix: five shape actions in two columns beside the tile grid.
- Triggers panel: sentence rows ("Start button clicked → go to slide 2...") with chips.
- Publish dialog structure: target cards, completion rule, pass mark, checks, size meter.
- Dark chrome with a single accent, and the accent-driven recolouring.
