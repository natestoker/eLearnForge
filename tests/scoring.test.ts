import { Runtime } from '../src/engine/runtime';
import { encodeResume } from '../src/tracking/adapter';
import { scorm12Manifest, scorm2004Manifest } from '../src/publish/manifests';
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const blk = (id: string, type: string) => ({ id, type, props: {} }) as any;
const mk = (completion: any, nSlides = 2) => ({
  id: 'p', title: 't', variables: [], completion,
  slides: Array.from({ length: nSlides }, (_, i) => ({
    id: 's' + i, name: 's' + i, width: 1280, height: 720, triggers: [],
    layers: [{ id: 'l' + i, name: 'base', visibleByDefault: true, blocks: i === 0 ? [blk('q1', 'multipleChoice'), blk('q2', 'matching'), blk('q3', 'fillBlank'), blk('q4', 'scenario'), blk('t', 'text')] : [blk('q5', 'dragDrop'), blk('q6', 'sequence')] }]
  }))
}) as any;
const run = (completion: any) => {
  const rt = new Runtime(mk(completion));
  const ev: any[] = [];
  rt.onTrack((e) => ev.push(e));
  return { rt, ev };
};
// auto score: 5 graded (scenario + text excluded)
let { rt, ev } = run({ mode: 'allSlides', autoScore: true });
rt.reportInteraction('q1', 'a', true);
eq('auto 1/5', rt.getScore(), 20);
rt.reportInteraction('q1', 'a', false); rt.reportInteraction('q1', 'a', true);
eq('retry replaces, not adds', rt.getScore(), 20);
rt.reportInteraction('q2', 'a', true); rt.reportInteraction('q3', 'a', true); rt.reportInteraction('q4', 'a', true);
eq('scenario not counted', rt.getScore(), 60);
rt.reportInteraction('q5', 'a', true);
eq('4/5', rt.getScore(), 80);
eq('scored event passed at 80', ev.filter(e => e.type === 'scored').pop(), { type: 'scored', score: 80, passed: true, gated: false });
// passed mode
({ rt, ev } = run({ mode: 'passed', autoScore: true, passingScore: 60 }));
rt.reportInteraction('q1', 'a', true); rt.reportInteraction('q2', 'a', true);
eq('40% not complete', ev.some(e => e.type === 'completed'), false);
rt.reportInteraction('q3', 'a', true);
eq('60% completes, passed', ev.filter(e => e.type === 'completed'), [{ type: 'completed', passed: true }]);
eq('gated flag on scored', ev.filter(e => e.type === 'scored')[0].gated, true);
// viewedAndPassed: pass first, still needs all slides
({ rt, ev } = run({ mode: 'viewedAndPassed', autoScore: true, passingScore: 20 }));
rt.reportInteraction('q1', 'a', true);
eq('passed but slide 2 unseen', ev.some(e => e.type === 'completed'), false);
rt.enterSlide('s1');
eq('then viewing completes', ev.filter(e => e.type === 'completed'), [{ type: 'completed', passed: true }]);
// allSlides unchanged: no passed field
({ rt, ev } = run({ mode: 'allSlides' }));
rt.enterSlide('s1');
eq('allSlides completes, no passed key', ev.filter(e => e.type === 'completed'), [{ type: 'completed' }]);
// autoScore off: interactions do not score
({ rt, ev } = run({ mode: 'allSlides' }));
rt.reportInteraction('q1', 'a', true);
eq('autoScore off -> no score', rt.getScore(), null);
// setScore action + 0 is a real score
({ rt, ev } = run({ mode: 'passed', passingScore: 0 }));
(rt as any).applyScore(0);
eq('score 0 with pass mark 0 passes', ev.some(e => e.type === 'completed'), true);
// resume round trip
({ rt } = run({ mode: 'allSlides', autoScore: true }));
rt.reportInteraction('q1', 'a', true); rt.reportInteraction('q2', 'a', true);
const saved = JSON.parse(encodeResume(rt.getResumeState()));
const r2 = new Runtime(mk({ mode: 'allSlides', autoScore: true })); r2.restoreState(saved);
eq('resume restores score', r2.getScore(), 40);
r2.reportInteraction('q3', 'a', true);
eq('resume keeps earlier answers', r2.getScore(), 60);
// oversize suspend data keeps score
const big = { slideId: 's0', viewedSlideIds: [], variables: Object.fromEntries(Array.from({ length: 400 }, (_, i) => ['v' + i, 'x'.repeat(20)])), score: 55, answers: { q1: true } };
const enc = JSON.parse(encodeResume(big as any));
eq('oversize: score kept, <=4000', [enc.score, encodeResume(big as any).length <= 4000], [55, true]);
// manifests
eq('1.2 mastery present', scorm12Manifest('t', 75).includes('<adlcp:masteryscore>75</adlcp:masteryscore>'), true);
eq('1.2 mastery absent by default', scorm12Manifest('t').includes('masteryscore'), false);
eq('2004 min measure', scorm2004Manifest('t', 75).includes('<imsss:minNormalizedMeasure>0.75</imsss:minNormalizedMeasure>'), true);
eq('2004 absent by default', scorm2004Manifest('t').includes('imsss:sequencing'), false);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
