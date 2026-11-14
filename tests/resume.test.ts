import { Runtime } from '../src/engine/runtime';
import { encodeResume, decodeResume } from '../src/tracking/adapter';
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`); };
const uid = () => Math.random().toString(36).slice(2, 12);
const build = (nSlides: number, nVars: number, every: number) => {
  const slides = Array.from({ length: nSlides }, (_, i) => ({ id: 'sld_' + uid(), name: 's' + i, width: 1, height: 1, triggers: [],
    layers: [{ id: 'lay_' + uid(), name: 'b', visibleByDefault: true, blocks: i % every === 0 ? [{ id: 'blk_' + uid(), type: 'multipleChoice', props: {} }] : [] }] }));
  const variables = Array.from({ length: nVars }, (_, i) => ({ id: 'var_' + uid(), name: 'flag_number_' + i, type: 'number', defaultValue: 0 }));
  return { id: 'p', title: 't', slides, variables, completion: { mode: 'allSlides', autoScore: true, maxAttempts: 3 } } as any;
};
const play = (project: any) => {
  const rt = new Runtime(project);
  project.slides.forEach((s: any) => rt.enterSlide(s.id));
  project.variables.forEach((v: any) => rt.setVariable(v.id, 7));
  project.slides.flatMap((s: any) => s.layers[0].blocks).forEach((b: any, i: number) => { rt.reportInteraction(b.id, 'x', i % 3 !== 0); rt.reportInteraction(b.id, 'x', i % 2 === 0); });
  return rt;
};
// big course: 250 slides, 90 variables, 125 questions
const big = build(250, 90, 2);
let rt = play(big);
const rich = JSON.stringify(rt.getResumeState());
const compact = encodeResume(rt.exportResume());
console.log(`   rich ${rich.length} chars (old format would be trimmed to fit) | compact ${compact.length} chars`);
eq('compact is much smaller than rich', compact.length < rich.length / 2, true);
const rt2 = new Runtime(build(250, 90, 2));
// round trip on the SAME project
rt2.restoreState(decodeResume(encodeResume(play(big).exportResume()))!);
const back = new Runtime(big); back.restoreState(decodeResume(encodeResume(rt.exportResume()))!);
eq('score restored', back.getScore(), rt.getScore());
eq('position restored', back.getSnapshot().slideId, rt.getSnapshot().slideId);
eq('all slides viewed restored', back.getResumeState().viewedSlideIds.length, 250);
eq('answers restored', JSON.stringify(back.getResumeState().answers), JSON.stringify(rt.getResumeState().answers));
eq('attempts restored', JSON.stringify(back.getResumeState().attempts), JSON.stringify(rt.getResumeState().attempts));
eq('variables restored', Object.keys(back.getResumeState().variables).length, 90);
eq('stays under the SCORM 1.2 cap', compact.length <= 4000, true);

// a state saved by a different version of the course is only partly applied
const edited = build(251, 90, 2);   // one slide more
const e1 = new Runtime(edited); e1.restoreState(decodeResume(compact)!);
eq('slide-count mismatch: starts at slide 1, viewed ignored', [e1.getSnapshot().slideId === edited.slides[0].id, e1.getResumeState().viewedSlideIds.length], [true, 1]);
eq('slide-count mismatch: variables still restored', Object.keys(e1.getResumeState().variables).length, 90);
const edited2 = build(250, 90, 3);  // different question count
const e2 = new Runtime(edited2); e2.restoreState(decodeResume(compact)!);
eq('question-count mismatch: answers dropped, position kept', [Object.keys(e2.getResumeState().answers ?? {}).length, e2.getSnapshot().slideId === edited2.slides[rt.getResumeState().slideId ? 249 : 0].id], [0, true]);

// legacy (id-keyed) state still restores
const small = build(5, 2, 1); const r0 = play(small);
const legacy = JSON.stringify(r0.getResumeState());
const l = new Runtime(small); l.restoreState(decodeResume(legacy)!);
eq('legacy rich state restores', [l.getScore(), l.getResumeState().viewedSlideIds.length], [r0.getScore(), 5]);

// over the cap: shed variables first, keep score + answers
const huge = build(400, 300, 1); const rh = play(huge);
const enc = encodeResume(rh.exportResume());
eq('even a huge course stays under the cap', enc.length <= 4000, true);
const dec: any = JSON.parse(enc);
eq('huge course keeps position and score', [typeof dec.si, dec.sc], ['number', rh.getScore()]);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
