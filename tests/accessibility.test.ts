import { accessibilityFor } from '../src/runtime/accessibility';
import { runChecks } from '../src/publish/checks';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
};
const blk = (type: string, props: any = {}, extra: any = {}) => ({ id: 'b_' + type, type, props, ...extra }) as any;

// Interactive blocks must never be hidden from screen readers, even with no plain text.
for (const t of ['dragDrop', 'matching', 'sequence', 'fillBlank', 'flashcards', 'tabs', 'slider', 'checklist', 'scenario', 'textEntry', 'labeledGraphic', 'results']) {
  eq(`${t} is exposed in Auto mode`, accessibilityFor(blk(t)).hidden, false);
}
eq('a plain shape is decorative', accessibilityFor(blk('shape')).hidden, true);
eq('an image with no alt is decorative', accessibilityFor(blk('image', { alt: '' })).hidden, true);
eq('an image with alt is exposed', accessibilityFor(blk('image', { alt: 'A chart' })).hidden, false);
eq('author can still exclude an interactive block', accessibilityFor(blk('dragDrop', {}, { aria: 'exclude' })).hidden, true);

// Publish checks for banks
const slide = (id: string) => ({ id, name: id, width: 1, height: 1, triggers: [], layers: [{ id: 'l' + id, name: 'b', visibleByDefault: true, blocks: [] }] });
const proj = (banks: any[]) => ({ id: 'p', title: 't', variables: [], slides: [slide('a'), slide('b'), slide('c')], banks }) as any;
const titles = (banks: any[]) => runChecks(proj(banks), 'web').map((c) => c.title);
eq('empty bank is warned', titles([{ id: '1', name: 'Quiz', slideIds: [], draw: 0, shuffle: false }]).some((t) => /is empty/.test(t)), true);
eq('drawing more than the pool is warned', titles([{ id: '1', name: 'Quiz', slideIds: ['a', 'b'], draw: 5, shuffle: false }]).some((t) => /draws 5 but has only 2/.test(t)), true);
eq('a slide in two banks is warned', titles([{ id: '1', name: 'One', slideIds: ['a'], draw: 0, shuffle: false }, { id: '2', name: 'Two', slideIds: ['a', 'b'], draw: 0, shuffle: false }]).some((t) => /in two banks/.test(t)), true);
eq('a sound bank produces a pass, no bank warnings', titles([{ id: '1', name: 'Quiz', slideIds: ['a', 'b', 'c'], draw: 2, shuffle: true }]).filter((t) => /bank|draws|empty/i.test(t)), ['Question banks draw a random selection per learner']);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
