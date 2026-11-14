import { Runtime } from '../src/engine/runtime';
import { encodeResume, decodeResume } from '../src/tracking/adapter';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
};
const q = (id: string) => ({ id, type: 'multipleChoice', props: {} }) as any;
const slide = (id: string, blocks: any[] = [], extra: any = {}) => ({ id, name: id, width: 1, height: 1, triggers: [],
  layers: [{ id: 'l_' + id, name: 'b', visibleByDefault: true, blocks }], ...extra });
// intro, q1..q6 (a bank), outro, plus a lightbox
const slides = [slide('intro'), ...[1, 2, 3, 4, 5, 6].map((n) => slide('q' + n, [q('b' + n)])), slide('outro'), slide('popup', [], { lightbox: true })];
const mk = (banks: any[], extra: any = {}) => ({ id: 'p', title: 't', variables: [], slides, banks, ...extra }) as any;
const bank = (over: any = {}) => ({ id: 'bk1', name: 'Quiz', slideIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'], draw: 3, shuffle: false, ...over });
const order = (rt: Runtime) => rt.effectiveSlides().map((s) => s.id);

// no banks: lightbox is left out, everything else in course order
eq('no banks: lightbox excluded', order(new Runtime(mk([]))), ['intro', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'outro']);

// draw 3 of 6
let rt = new Runtime(mk([bank()]));
let o = order(rt);
eq('draw 3: intro and outro stay at the ends', [o[0], o[o.length - 1], o.length], ['intro', 'outro', 5]);
const drawn = o.slice(1, 4);
eq('drawn slides are all bank members, no repeats', [drawn.every((id) => /^q[1-6]$/.test(id)), new Set(drawn).size], [true, 3]);
eq('unshuffled draw keeps course order', JSON.stringify(drawn) === JSON.stringify([...drawn].sort()), true);
eq('total slides counts the drawn ones', rt.resolveReference('TotalSlides'), '5');

// randomness actually varies across learners
const seen = new Set<string>();
for (let i = 0; i < 40; i++) seen.add(order(new Runtime(mk([bank()]))).join(','));
eq('different learners get different draws', seen.size > 3, true);
// shuffle changes order within the draw
const shuffled = new Set<string>();
for (let i = 0; i < 40; i++) shuffled.add(order(new Runtime(mk([bank({ draw: 0, shuffle: true })]))).join(','));
eq('shuffle gives different orders', shuffled.size > 5, true);

// Next / Back follow the learner's order
rt = new Runtime(mk([bank()]));
const seq = order(rt);
rt.stepSlide(1);
eq('Next goes to the second slide of this learner\'s order', rt.getSnapshot().slideId, seq[1]);
rt.stepSlide(-1);
eq('Back returns', rt.getSnapshot().slideId, seq[0]);
eq('neighbor of a left-out slide is the nearest one', typeof rt.neighborSlideId(['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].find((id) => !seq.includes(id))!, 1), 'string');

// completion needs only the slides this learner got
rt = new Runtime(mk([bank()], { completion: { mode: 'allSlides' } }));
const events: any[] = []; rt.onTrack((e) => events.push(e));
order(rt).forEach((id) => rt.enterSlide(id));
eq('allSlides completes after viewing only the drawn slides', events.some((e) => e.type === 'completed'), true);

// score counts only the drawn questions
rt = new Runtime(mk([bank()], { completion: { mode: 'allSlides', autoScore: true } }));
const gotQs = order(rt).filter((id) => id.startsWith('q'));
gotQs.forEach((id) => rt.reportInteraction('b' + id.slice(1), 'x', true));
eq('all drawn questions right = 100%', rt.getScore(), 100);

// resume restores the same draw, and the answers line up with it
rt = new Runtime(mk([bank({ draw: 3, shuffle: true })], { completion: { mode: 'allSlides', autoScore: true } }));
const before = order(rt);
rt.reportInteraction('b' + before[1].slice(1), 'x', true);
const saved = encodeResume(rt.exportResume());
let restoredSame = 0;
for (let i = 0; i < 10; i++) {
  const r2 = new Runtime(mk([bank({ draw: 3, shuffle: true })], { completion: { mode: 'allSlides', autoScore: true } }));
  r2.restoreState(decodeResume(saved)!);
  if (JSON.stringify(order(r2)) === JSON.stringify(before)) restoredSame++;
  if (i === 0) eq('resume: score restored against the same draw', r2.getScore(), rt.getScore());
}
eq('resume: the same questions every time', restoredSame, 10);

// a bank edited after the learner started: ignore the stale draw instead of breaking
const edited = new Runtime(mk([bank({ slideIds: ['q1', 'q2', 'q3'] })]));
edited.restoreState(decodeResume(saved)!);
eq('stale draw is ignored safely', order(edited).length >= 3, true);

// overlapping banks: first bank wins, nothing is duplicated
rt = new Runtime(mk([bank({ draw: 0 }), bank({ id: 'bk2', slideIds: ['q1', 'q2'], draw: 1 })]));
eq('a slide in two banks appears once', new Set(order(rt)).size, order(rt).length);
// a deleted slide in a bank is ignored
rt = new Runtime(mk([bank({ slideIds: ['q1', 'ghost', 'q2'], draw: 0 })]));
eq('missing slides in a bank are ignored', [order(rt).includes('ghost'), order(rt).includes('q1'), order(rt).includes('q2'), order(rt).length], [false, true, true, 8]);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
