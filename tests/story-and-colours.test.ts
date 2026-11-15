import { contrast, deriveAccent } from '../src/shared/accent';
import { gridColumns } from '../src/editor/StoryView';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : detail); };
const finish = () => { console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0); };

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const white: [number, number, number] = [255, 255, 255];

// The accent used as text inside slides clears 4.5:1 on white, whatever the author picks.
for (const accent of ['#3ddc97', '#ffd400', '#ff7a59', '#7db7ff', '#ffffff', '#123456']) {
  const text = deriveAccent(accent)['--c-accent-text'];
  check(`${accent} as slide text reads on white`, contrast(rgb(text), white) >= 4.5, text);
}
check('a dark accent is left as it is', deriveAccent('#123456')['--c-accent-text'] === '#123456');

// Feedback colours read on their own surfaces.
const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
const token = (name: string) => new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)![1];
for (const kind of ['correct', 'incorrect']) {
  const ratio = contrast(rgb(token(`--c-${kind}`)), rgb(token(`--c-${kind}-surface`)));
  check(`--c-${kind} on its surface is at least 4.5:1`, ratio >= 4.5, ratio.toFixed(2));
}
check('course colours never point at chrome tokens', !/--c-[a-z-]+:\s*var\(/.test(css));

// Story view grid: as many columns as fit, never fewer than one.
check('a wide dialog fits several columns', gridColumns(1300) >= 5);
check('a narrow dialog still has one column', gridColumns(120) === 1);
check('more width never gives fewer columns', gridColumns(900) <= gridColumns(1200));

finish();
