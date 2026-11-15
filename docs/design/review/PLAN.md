# Redesign plan (from Claude Design's review, Nov 2026)

`REVIEW.txt` is the text of the review. The order below is the review's own.

| Phase | What | Status |
| --- | --- | --- |
| 1 | **Tokens** in `src/styles.css`: type (6 steps, 11px minimum), radius (3 + pill), spacing, z layers, shadows, `--border-strong`, status colors. Chrome rules moved onto them (145 font sizes, 110 radii). Publish and Triggers moved from blue-grey onto the root neutrals. Input outlines on `--border-strong`. | Done, except: spacing and z-index values are defined but rules still use literals; no stylelint rule yet; course-content `--c-*` namespace not started. |
| 2 | **One dialog shell**; Player Settings, Resources, Glossary and Banks become sections of a single Course settings dialog (with Accent, Brand colours, default transition, a live player preview, real empty states). Pen tool, Welcome, Story view and Publish on the same shell. | Not started |
| 3 | **Ribbon holds commands, forms move to the inspector.** Seven tabs become four (Insert, Arrange, Animate, View) on a 96px shelf with a More menu; Slide settings become the inspector's empty state; Triggers and Variables become right-panel tabs with count badges; animation timing edited in one place. | Not started |
| 4 | **Phone player**: reflow to one column under 600px (16px text, 44px targets), fit view with a rotate hint for position-dependent slides, per-slide Auto / Reflow / Fit, tap-to-place drag and drop, Phone preview, a publish check. | Not started |
| 5 | **Everything else**: quiz feedback with an icon and a word; a real end-of-course state; undo toast for deletes; one Menu primitive; one save indicator; zoom into the status bar; collapsing Layers; timeline at 24px rows; variables with friendly names; typed glyphs replaced by Lucide; Publish loose ends. | Not started |

Phases 2 to 4 each change how the editor is organised, so each should land on its own and be looked at before the next.
