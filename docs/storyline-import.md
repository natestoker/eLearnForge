# Opening Storyline files

File > Open Storyline (.story) reads an Articulate Storyline 360 project and
turns it into an eLearnForge project. It is an editable approximation, like
the PowerPoint import: the slides, text, pictures, layers and logic come
across; pixel-perfect rendering does not.

After a file opens, a report lists anything that had no equivalent, by slide.

## What comes across

| Storyline | eLearnForge |
| --- | --- |
| Scenes and slide order | Slides in the same order (scene names are not kept yet) |
| Slide size | Slide size |
| Text boxes | Text blocks: bold, italic, underline, size, colour, font, alignment, bullets, superscript |
| Pictures and SVGs | Image blocks, with alt text and rotation |
| Rectangles, rounded rectangles, ovals, triangles and other preset shapes | Shape blocks with fill and outline; a shape's text becomes a text block on top of it |
| Lines | Line shapes |
| Buttons | Button blocks |
| Markers | The marker icon, plus a layer holding its label (click the icon to open, click the label to close) |
| Groups | The objects inside, ungrouped. A trigger aimed at the group acts on all of them |
| Layers | Layers, hidden to start |
| Master and layout artwork, backgrounds | Locked blocks under the slide's own objects; slide background |
| Object start time and duration | Timeline bars |
| Entrance and exit animations | The nearest animation (fade, fly, float, wipe, grow, zoom, spin, bounce, swivel) |
| States: Hover, Down, Visited, Selected, Disabled | State styles (fill, outline, text colour) |
| Initial state Hidden | A "slide loads: hide block" trigger |
| Variables you made | Variables. Built-in ones (Player., Project., Slide.) are left behind |
| Notes | Speaker notes |
| Hidden Next / Previous | Per-slide navigation override |

### Triggers

| Storyline | eLearnForge |
| --- | --- |
| When the user clicks / hovers / double-clicks | onClick / onHover / onDoubleClick |
| When the timeline starts on a slide | Slide loads |
| When the timeline starts on a layer | A layer is shown |
| When the timeline starts on an object | Block enters the frame |
| When the timeline ends | Timeline ends |
| When an animation completes | Block finishes animating in |
| When the state of objects is... | Blocks all reach a state |
| When a key is pressed | A key is pressed |
| When Next / Previous is clicked (custom) | Next is pressed / Back is pressed |
| Jump to slide (next, previous, a named slide) | Next slide / previous slide / go to slide |
| Show layer, hide layer | Show layer / hide layer |
| Adjust variable (set, add, subtract) | Set variable / adjust variable |
| Change state of | Set state |
| Lightbox slide, close lightbox | Open lightbox / close lightbox |
| Play emphasis animation | Pulse block |
| Jump to URL | Open URL |
| Complete course, exit course | Complete course / exit course |
| Execute JavaScript | Run JavaScript, with a note that GetPlayer() calls need rewriting |
| Conditions on variables and object states | Conditions (and / or) |

Anything else is kept as a **Run JavaScript** trigger whose code is a comment
saying what the original did, so the logic is not silently lost and you can
see where to rebuild it.

### Quiz questions

Freeform **Pick One**, **Pick Many** and **True/False** questions work after
import. The choices select like radio buttons or checkboxes, the question's
feedback layers come in named Correct, Incorrect and Try again, and Submit
shows the right one. A question with no correct answer (a survey or rating)
shows its Thank you layer.

Storyline's **form questions** (the ones built in Form view) and the other
freeform types carry their answers as data, so they arrive as eLearnForge quiz
blocks. The block replaces the Storyline shapes that drew the question and
shows the feedback text from its Correct and Incorrect layers.

| Storyline question | Arrives as |
| --- | --- |
| True/False, Multiple Choice, Word Bank | Multiple choice |
| Multiple Response | Multiple choice, several answers |
| Matching Drag and Drop, Matching Drop-down | Matching |
| Sequence Drag and Drop, Sequence Drop-down | Sequence |
| Fill-in-the-Blank, Numeric ("equal to") | Fill in the blank |
| Freeform Text Entry | Fill in the blank, placed where the field was |
| Freeform Drag and Drop | Matching when every slot takes one item, otherwise drag and drop |
| Hotspot, freeform Hotspot | The hotspots, each showing the Correct or Incorrect layer when clicked |
| Short Answer, Essay, How Many | A plain text field (no right answer) |
| Pick One, Pick Many, Likert, Ranking (survey) | The choices as a list (no right answer) |

Where drop slots all carry the same prompt ("Drop here") and are named by a
label beside them, the label names the slot. A Submit button that belonged to
a converted question is removed, since the block checks itself.

**Result slides** keep their design. Text that read the quiz variables
(`%Quiz1.ScorePercent%`, `%Quiz1.PassPercent%`) reads `%Score%` and
`%PassPercent%`; points are shown as percent. The Success and Failure layers
follow a "Quiz score" trigger condition against the quiz's pass mark, and the
pass mark becomes the course's pass mark with automatic scoring on.

Not carried yet: points per question, attempt limits, shuffling, Review
Quiz and Reset Quiz.

## Not converted yet

- Video narration timing has only been checked on files without media;
  video objects import, but treat them as unverified.
- Question banks, numeric questions that use a range, and picture-only drag
  items (those stay as their original shapes).
- Sliders, dials, scrolling panels, web objects: a labelled outline marks
  where each one was.
- Custom states (anything other than the built-in six) and motion paths.
- Player settings (menu, colours, glossary, resources).
- Picture crops, gradients beyond two stops, shadows and other effects.

## Saving back to .story

File > Save as Storyline (.story) writes the project as a Storyline 360 file.
It starts from a blank project saved by Storyline (masters, theme and player
settings come from there) and replaces its slide with yours. A report after
saving lists what was left out.

**Status.** Checked by opening test files in Storyline 360 (3.130): slides,
text, shapes, notes, variables, layers, and click, hover, key-press and
variable-condition triggers open correctly. Pictures and Execute JavaScript
are written in the confirmed form but were still being checked when this was
written.

Written:

- Slides, slide size, notes, layers.
- Text (bold, italic, underline, size, colour, font, alignment, bullets).
- Pictures (all saved as PNG), with alt text and rotation.
- Rectangles, rounded rectangles, ovals, triangles, lines. Buttons become
  rounded rectangles with a label.
- Start time and duration; fade, fly, float, wipe and grow entrances.
- Your variables.
- Triggers: click, slide loads, timeline ends, animation finishes, block
  enters, layer shown, hover, key press (arrows, letters, digits), custom Next; with jump to slide, next/previous slide,
  show and hide layer, lightbox, set/adjust variable, set state, show/hide block,
  complete course. Conditions on variables using =, < or >.

Quiz blocks are saved as Storyline **freeform questions**:

| eLearnForge block | Storyline question |
| --- | --- |
| Multiple choice | Pick One, or Pick Many when it allows several answers |
| Drag and drop | Drag and Drop: items on the left, targets on the right |
| Matching | Drag and Drop: drag each meaning onto its term |
| Sequence | Drag and Drop: drag each step into its numbered slot |

Each gets a question text box, a Submit button and Correct and Incorrect
feedback layers. Pick choices carry Normal, Hover and Selected states.
Storyline allows one question per slide, so a second quiz block on the same
slide stays an outlined box. Each question is worth 10 points with one
attempt; change that in Storyline's Question tab.

Other blocks: **tabs and accordions** become a button per panel and a layer
per panel (the first one shows when the slide starts). A **progress** block
becomes a text readout ("Slide 3 of 6", or the variable it follows). Sizes
scale with the slide, so a 1920-wide project gets proportionally larger text
and outlines.

**Font sizes.** Storyline defines a point size on a 960-wide slide and scales
it with the slide, so 14pt on a 1920-wide slide is twice as large as on a
960-wide one. Saving divides by that factor and opening multiplies by it, so
text keeps its real size both ways.

**Autofit.** A shape whose text fits the box as drawn keeps a fixed size
("Do not autofit"), so it does not change when selected in Storyline. Only a
shape whose text would not fit is set to "Expand height". Text margins are
always whole numbers: Storyline rejects a file with a decimal there.

**Audio.** An audio block, or audio attached to a block, is saved as a
Storyline sound at its start time. MP3 goes in as it is; anything else is
converted to MP3. The slide's captions become the clip's caption file, and
the slide is lengthened to cover its audio. Opening a file reads sounds
(including AI voice clips) back as audio blocks and their captions onto the
slide. Written from a real file's form; not yet confirmed by opening in
Storyline.

**Backgrounds.** A slide's colour, gradient or picture background is saved as
a full-slide picture named Background at the back of the base layer.

**Value displays.** Slide number, total slides, slides viewed and progress
use Storyline's own `Project.` variables. The score has no built-in without a
result slide, so the file gets a number variable named `Score` and each
question's Correct layer adds its share of 100 to it.

Left out, and listed in the report:

- Fill-in-the-blank, sliders, flashcards, scenarios and the other interactive
  blocks not listed above: an outlined box marks where each one was.
- Audio and video. Add narration in Storyline (Insert > Audio).
- Actions with no Storyline equivalent are saved as Execute JavaScript
  triggers: Run JavaScript carries its code, Open URL becomes `window.open`,
  and anything else becomes a comment describing the action.
- Triggers on events with no confirmed Storyline form (double-click, cue
  point, mouse leave, Submit).
- State styles, shadows, gradients, custom (pen) shapes, groups (saved
  ungrouped).
