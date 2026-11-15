# Design package for Claude Design

Everything Claude Design needs to review eLearnForge screen by screen, built from the real code instead of a description.

## What's here

| File | What it is |
| --- | --- |
| `screens/*.png` | 44 screenshots of every screen and state: the editor (ribbon tabs, panels, dialogs, menus), the player at desktop width (1280×720) and on a phone (390×844). `screens/_index.json` says what each one shows. |
| `ISSUES.md` | What's wrong, ranked by how much it hurts, each tied to a screenshot and a source file. |
| `TOKENS.md` | The design tokens that exist today, plus numbers on how far the CSS has drifted from them. |
| `COMPONENTS.md` | The inventory: every UI component and the file it lives in. |

Regenerate the screenshots any time with:

```bash
npm run build && node scripts/capture-screens.mjs
```

## What we want back

1. A pass over every screen in `screens/`, not only the ones named in `ISSUES.md`. The list is what I noticed; I'm sure there's more.
2. A small, enforced token set (type scale, radii, spacing, one set of neutrals) that replaces the one-off values in `src/styles.css`. See `TOKENS.md`.
3. A single dialog pattern. Publish (new) and Player Settings, Resources, Glossary, Banks (old `Modal`) look like they belong to different products.
4. A real answer for phones. The player letterboxes a 16:9 slide into a narrow screen, so slide text ends up unreadably small.

## Constraints that aren't negotiable

- **Dark editor, light slides.** The slide canvas is white (or whatever the author picks); the surrounding chrome is dark. Keep it.
- **Accent is user-chosen.** The course accent (Home > Accent) recolours the editor and the player, so no mint is hardcoded: use `--accent`, `--accent-rgb`, `--accent-bright`, `--accent-dim`, `--accent-ink`. `src/shared/accent.ts` keeps it readable on any pick.
- **WCAG AA.** The player passes axe-core for A and AA (`tests/e2e/accessibility.e2e.mjs`) and the editor chrome is held to 4.5:1. A redesign has to stay inside that.
- **One offline HTML file.** No external fonts or CDNs in the published player; the editor loads Google Fonts only for fonts a course actually uses.
- **Icons are Lucide**, inlined in `src/editor/lucide.tsx`. Add new icons there rather than mixing in another family.
- **It's a desktop authoring tool.** The editor needs a wide screen; the player must work on phones.

## Keeping Claude Design in sync with the code

If you use Claude Design's design-system projects, the `/design-sync` skill pushes a local component library into one, a component at a time. Run it from this repo and point it at `docs/design/` (screenshots, tokens, components). I can prepare the files; you start the skill.
