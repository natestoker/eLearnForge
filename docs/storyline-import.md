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

## Not converted yet

- Audio and video narration timing has only been checked on files without
  media; audio and video objects import, but treat them as unverified.
- Quiz and survey slides, result slides, question banks.
- Sliders, dials, scrolling panels, web objects, input fields: a labelled
  outline marks where each one was.
- Custom states (anything other than the built-in six) and motion paths.
- Player settings (menu, colours, glossary, resources).
- Picture crops, gradients beyond two stops, shadows and other effects.

## Saving back to .story

File > Save as Storyline (.story) writes the project as a Storyline 360 file.
It starts from a blank project saved by Storyline (masters, theme and player
settings come from there) and replaces its slide with yours. A report after
saving lists what was left out.

**Status: unconfirmed.** The file matches real Storyline files element for
element and opens again in eLearnForge, but it has not yet been opened in
Storyline itself. Treat it as experimental until that is checked.

Written:

- Slides, slide size, notes, layers.
- Text (bold, italic, underline, size, colour, font, alignment, bullets).
- Pictures (all saved as PNG), with alt text and rotation.
- Rectangles, rounded rectangles, ovals, triangles, lines. Buttons become
  rounded rectangles with a label.
- Start time and duration; fade, fly, float, wipe and grow entrances.
- Your variables.
- Triggers: click, slide loads, timeline ends, animation finishes, block
  enters, layer shown, custom Next; with jump to slide, next/previous slide,
  show layer, lightbox, set/adjust variable, set state, show/hide block,
  complete course. Conditions on variables using =, < or >.

Left out, and listed in the report:

- Quiz, drag and drop, sliders and the other interactive blocks: an outlined
  box marks where each one was.
- Audio and video. Add narration in Storyline (Insert > Audio).
- Triggers and actions with no confirmed Storyline form, including Run
  JavaScript, hide layer, open URL, hover and key press. These are next, once
  there is a sample file from Storyline showing how each is stored.
- State styles, shadows, gradients, custom (pen) shapes, groups (saved
  ungrouped).
