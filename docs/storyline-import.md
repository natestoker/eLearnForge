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

Not available yet. Writing a file Storyline will open needs a blank project
saved from Storyline itself to use as the shell (masters, theme and player
settings), and each change has to be checked by opening the result in
Storyline.
