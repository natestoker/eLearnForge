# Screen reader checklist

A 15-minute listening pass for the published demo course. Orca on Linux has
already been through these steps (see item 5 in `AUDIT.md`); this is the same
script for the readers most learners use.

Run it once with **NVDA + Chrome**. Repeat with **JAWS + Chrome** and
**VoiceOver + Safari** only if something fails or after a fix.

## Set-up

1. Open eLearnForge, load the demo course (Welcome screen > demo), Publish >
   Web, and open the downloaded HTML file in the browser.
2. Start the screen reader. NVDA: `Ctrl+Alt+N`. JAWS runs 40 minutes without
   a licence. VoiceOver: `Cmd+F5`.
3. Keep the browser window focused. Do not use the mouse after this point.

Wording differs a little between readers ("button" against "push button").
The point is whether the right thing is announced at all.

## Steps

| # | Do | Should hear |
| --- | --- | --- |
| 1 | Load the page, press `Tab` once | The course name, then the first control |
| 2 | `Tab` to the menu button, `Enter` | "Show navigation", collapsed, then expanded, and the slide list |
| 3 | `Escape`, then `Tab` to Next, `Enter` | "Spot the red flags, slide 2 of 6" |
| 4 | `Tab` through the slide | Each hotspot by name ("Sender hotspot" and so on), as a button |
| 5 | `Enter` on a hotspot | The layer's heading and text; `Tab` reaches its close control |
| 6 | Next to slide 3, `Tab` to the tabs | Each tab by label, and which one is selected |
| 7 | `Enter` on "Open hint" (if present) | "Hint popup, dialog", then a Close button; `Escape` returns to "Open hint" |
| 8 | Next to slide 4, `Tab` into the question | The question text, then each choice as a radio button, "not selected" |
| 9 | Arrow or `Space` to pick a wrong choice, `Tab` to Submit, `Enter` | The Incorrect feedback text, read without moving focus yourself |
| 10 | "Try again", pick the right choice, Submit | The Correct feedback text |
| 11 | Next to slide 5, `Tab` to a drag item, `Enter` | The item as a toggle button, then "Place in Phishing" and "Place in Probably safe" buttons |
| 12 | `Enter` on a Place button | Focus back on the item, now "pressed" or placed |
| 13 | Place the rest, `Tab` to Check, `Enter` | The feedback text |
| 14 | Next to slide 6 | "Summary, slide 6 of 6", then the score and progress read as text |
| 15 | `Tab` to the course controls | "Course controls", Play, a seek slider with its time, Back and Next |

## What to write down

For any step that fails, note three things:

- the step number;
- what you heard instead (or "silence");
- the reader and browser, with versions (NVDA: `NVDA+N` > Help > About).

"Silence after pressing Next" and "read the wrong thing" are different bugs,
so say which.

## Known from the Orca pass

- Slide changes, quiz feedback and unnamed hotspots were silent before v6.19
  and were fixed there. If any is silent in NVDA, that is the first thing to
  report.
- One Orca run skipped the announcement on slide 3 only, and it did not
  repeat. If NVDA does the same, note whether it happens every time.

## After the pass

Record the reader, browser, versions and result at the end of item 5 in
`AUDIT.md`. Fixes get the same steps re-run for the slides they touch, plus
the question slides.
