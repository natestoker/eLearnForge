# Tokens

## What exists today (`:root` in `src/styles.css`)

```css
--bg: #111412;        --bg-deep: #0d100e;
--panel: #171b18;     --panel-2: #1d221e;
--border: #2c3630;    --border-soft: #212823;
--text: #e7ece8;      --muted: #93a598;      --faint: #869789;  /* 5.2:1 on every panel */
--accent: #3ddc97;    --accent-bright: #5cf0b4;
--accent-dim: rgba(var(--accent-rgb), .14);  --accent-rgb: 61, 220, 151;  --accent-ink: #052a1b;
--audio: #ffb368;     --danger: #ff6b5e;
--mono: 'JetBrains Mono', ui-monospace, ...;
--content: ui-sans-serif, system-ui, ...;
```

The accent set is overwritten at runtime from the course accent (`src/shared/accent.ts`), so treat all five accent tokens as variables, never as the literal mint.

Warning and success colors don't exist as tokens: the Publish dialog invents `#f2b84b` (warn) and `#ff8a8a` (error) locally (`--pd-warn`, `--pd-err`), and the Triggers panel has its own set (`--tp-*`). Those should be shared.

## How far the CSS has drifted (3,768 lines, `src/styles.css`)

| What | Count | Note |
| --- | --- | --- |
| Distinct `font-size` values | 18 | 7, 9, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 17, 18, 20, 22, 26 px |
| Of those, at or under 10 px | 3 sizes, 49 uses | the micro-labels (ribbon group titles, field labels) |
| Distinct `border-radius` values | 13 | 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14 px and pills |
| Distinct hex colors | 89 | most are course-content colors (quiz, drag and drop), not chrome |
| `rgba(...)` literals | 138 | |
| Distinct `z-index` values | 27 | from 0 to 1200 |
| Media queries | 5 | all for the player on phones; the editor has none |

## What to ask for

1. **Type scale**: 5 or 6 steps with a stated minimum. Nothing in the chrome under 11 px.
2. **Radius scale**: 3 steps plus pill.
3. **Spacing scale** (4 px base) for gaps and padding; today it's whatever looked right.
4. **Elevation / z-index layers** with names (dropdown, popover, dialog, toast), not 27 numbers.
5. **Semantic colors**: success, warning, error, info, each with a text and a surface variant that clear AA on `--panel`.
6. **Course content colors** kept apart from chrome colors. Quiz and drag-and-drop styling (`.mc-*`, `.dd-*`, ...) is part of what a course author's learners see, and should be themeable per course; it isn't chrome.
