import { Runtime } from '../src/engine/runtime';
import { slideTriggerIssues, projectTriggerIssues } from '../src/engine/validate';
import { runChecks, sizeEstimate } from '../src/publish/checks';
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
};
const blk = (id: string, type = 'text', props: any = {}, extra: any = {}) => ({ id, type, props, ...extra }) as any;
const mk = (slides: any[], variables: any[] = [], extra: any = {}) => ({ id: 'p', title: 't', variables, slides, ...extra }) as any;
const slide = (id: string, blocks: any[], triggers: any[] = [], layers: any[] = []) => ({ id, name: id, width: 1, height: 1, triggers,
  layers: [{ id: 'base_' + id, name: 'base', visibleByDefault: true, blocks }, ...layers] });
const trig = (event: string, actions: any[], extra: any = {}) => ({ id: 'T' + Math.random().toString(36).slice(2, 7), event, conditions: [], actions, ...extra });

// enabled flag
let rt = new Runtime(mk([slide('s0', [], [trig('onKeyPress', [{ type: 'setScore', score: 50 }], { key: 'a', enabled: false }), trig('onKeyPress', [{ type: 'setScore', score: 70 }], { key: 'b' })])]));
rt.keyPress('a');
eq('disabled trigger does not run', rt.getScore(), null);
rt.keyPress('b');
eq('enabled trigger runs', rt.getScore(), 70);

// max attempts
rt = new Runtime(mk([slide('s0', [blk('q')])], [], { completion: { mode: 'allSlides', maxAttempts: 2 } }));
eq('not exhausted before answering', rt.attemptsExhausted('q'), false);
rt.reportInteraction('q', 'x', false);
eq('1 of 2 used', rt.attemptsExhausted('q'), false);
rt.reportInteraction('q', 'x', false);
eq('2 of 2 used -> locked', rt.attemptsExhausted('q'), true);
eq('other question unaffected', rt.attemptsExhausted('other'), false);
const saved = rt.getResumeState();
const r2 = new Runtime(mk([slide('s0', [blk('q')])], [], { completion: { mode: 'allSlides', maxAttempts: 2 } })); r2.restoreState(saved);
eq('attempts survive resume', r2.attemptsExhausted('q'), true);
rt = new Runtime(mk([slide('s0', [blk('q')])]));
for (let i = 0; i < 20; i++) rt.reportInteraction('q', 'x', false);
eq('unlimited by default', rt.attemptsExhausted('q'), false);

// validator
const p = mk([
  slide('s0', [blk('b1')], [
    trig('onClick', [{ type: 'showLayer', layerId: 'gone' }, { type: 'goToSlide', slideId: 's1' }], { sourceBlockId: 'b1' }),
    trig('onClick', [{ type: 'showBlock', blockId: 'nope' }], { sourceBlockId: 'b1' }),
    trig('onClick', [{ type: 'showBlock', blockId: 'self' }], { sourceBlockId: 'b1' }),
    trig('onSlideLoad', [{ type: 'showBlock', blockId: '' }]),
    trig('onClick', [{ type: 'setVariable', variableId: 'v1', value: 1 }], { sourceBlockId: 'ghost' }),
    trig('onKeyPress', [{ type: 'nextSlide' }], {}),
    trig('onVariableChange', [], { watchVariableId: 'gone' }),
    { ...trig('onSlideLoad', []), conditions: [{ variableId: 'gone', operator: 'eq', value: 1 }] }
  ]),
  slide('s1', [blk('b2')])
], [{ id: 'v1', name: 'n', type: 'number', defaultValue: 0 }]);
const is = slideTriggerIssues(p.slides[0], p);
const summary = is.map((i: any) => `${i.part}:${i.kind}:${i.missing}`);
eq('validator findings', summary, [
  'action:layer:deleted', 'action:block:deleted', 'action:block:unset', 'source:block:deleted', 'watch:key:unset', 'watch:variable:deleted', 'condition:variable:deleted'
]);
eq('"this object" is fine with a source', is.some((i: any) => i.message.includes('self')), false);
eq('goToSlide to a real slide is fine', is.filter((i: any) => i.kind === 'slide').length, 0);
eq('project-wide issues equal per-slide', projectTriggerIssues(p).length, is.length);

// publish checks
const clean = mk([slide('s0', [blk('q', 'multipleChoice')], []), slide('s1', [])], [], { completion: { mode: 'viewedAndPassed', autoScore: true } });
let ch = runChecks(clean, 'scorm2004');
eq('clean quiz course has no errors', ch.filter(c => c.sev === 'error').length, 0);
eq('score source reported', ch.some(c => /Score comes from 1 scored question/.test(c.title)), true);
ch = runChecks(mk([slide('s0', [])], [], { completion: { mode: 'passed' } }), 'scorm12');
eq('pass mode with no score source is an error', ch.some(c => c.sev === 'error' && /score is never set/.test(c.title)), true);
ch = runChecks(mk([slide('s0', [])], [], { completion: { mode: 'passed', autoScore: true } }), 'scorm12');
eq('auto score with no questions is an error', ch.some(c => c.sev === 'error' && /No scored questions/.test(c.title)), true);
ch = runChecks(mk([slide('s0', [])], [], { completion: { mode: 'explicit' } }), 'scorm2004');
eq('explicit with no complete action is an error', ch.some(c => c.sev === 'error' && /Nothing ever completes/.test(c.title)), true);
ch = runChecks(mk([slide('s0', [blk('b')], [trig('onClick', [{ type: 'completeCourse' }], { sourceBlockId: 'b' })])], [], { completion: { mode: 'explicit' } }), 'scorm2004');
eq('explicit with a complete action passes', ch.filter(c => c.sev === 'error').length, 0);
ch = runChecks(mk([slide('s0', [blk('i', 'image', { alt: '' }), blk('d', 'image', { alt: '' }, { aria: 'exclude' }), blk('ok', 'image', { alt: 'a chart' })])]), 'web');
eq('only the undecorated, alt-less image is flagged', ch.find(c => /missing alt/.test(c.title))?.title, '1 image missing alt text');
ch = runChecks(mk([slide('s0', []), slide('s1', []), slide('s2', [])], [], { player: { next: { show: false, label: 'Next' }, back: { show: false, label: 'Back' }, submit: { show: false, label: 'S' }, menu: { show: false } } }), 'web');
eq('hidden nav strands slides', ch.find(c => /can't be reached/.test(c.title))?.title, "2 slides can't be reached");
ch = runChecks(mk([slide('s0', []), slide('s1', [])], [], { player: { next: { show: false, label: 'Next' }, back: { show: false, label: 'Back' }, submit: { show: false, label: 'S' }, menu: { show: true, locked: false } } }), 'web');
eq('an open menu makes everything reachable', ch.some(c => /can't be reached/.test(c.title)), false);
const big = 'data:video/mp4;base64,' + 'A'.repeat(12 * 1024 * 1024);
ch = runChecks(mk([slide('s0', [blk('v', 'video', { src: big })])]), 'web');
eq('large media warned', ch.some(c => c.sev === 'warn' && c.title === 'Large media file'), true);
const sz = sizeEstimate(mk([slide('s0', [blk('v', 'video', { src: big }), blk('i', 'image', { src: 'data:image/png;base64,' + 'B'.repeat(1000) })])]), 500000);
eq('size split by kind', [sz.parts[0].bytes > 12e6, sz.parts[1].bytes > 1000 && sz.parts[1].bytes < 1100, sz.parts[3].bytes], [true, true, 500000]);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
