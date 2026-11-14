import { Runtime } from '../src/engine/runtime';
import { slideTriggerIssues } from '../src/engine/validate';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
};
const blk = (id: string) => ({ id, type: 'button', props: {} }) as any;
const trig = (event: string, actions: any[], extra: any = {}) => ({ id: 't' + Math.random().toString(36).slice(2, 6), event, conditions: [], actions, ...extra });
const slide = (id: string, blocks: any[], triggers: any[] = [], extra: any = {}) => ({ id, name: id, width: 1, height: 1, triggers,
  layers: [{ id: 'l_' + id, name: 'b', visibleByDefault: true, blocks }], ...extra });

const proj = () => ({ id: 'p', title: 't', variables: [], slides: [
  slide('s0', [blk('open')], [trig('onClick', [{ type: 'openLightbox', slideId: 'lb' }], { sourceBlockId: 'open' })]),
  slide('lb', [blk('inner')], [
    trig('onClick', [{ type: 'setScore', score: 77 }], { sourceBlockId: 'inner' }),
    trig('onSlideLoad', [{ type: 'hideBlock', blockId: 'inner' }, { type: 'showBlock', blockId: 'inner' }])
  ], { lightbox: true }),
  slide('s1', [])
] }) as any;

const rt = new Runtime(proj());
eq('lightbox is closed at start', rt.getLightbox(), null);
rt.clickBlock('open');
eq('clicking the trigger opens it', rt.getLightbox()?.id, 'lb');
eq('the slide underneath is unchanged', rt.getSnapshot().slideId, 's0');
eq('lightbox blocks are interactive', rt.blockHasInteractionTrigger('inner'), true);
rt.clickBlock('inner');
eq('a click inside the lightbox runs the lightbox slide\'s trigger', rt.getScore(), 77);
rt.closeLightbox();
eq('it closes', rt.getLightbox(), null);
eq('closed lightbox blocks stop firing', (rt.blockHasInteractionTrigger('inner')), false);

// reopening starts from the authored state
const rt2 = new Runtime(proj());
rt2.clickBlock('open'); rt2.setBlockState('inner', 'disabled'); rt2.closeLightbox(); rt2.clickBlock('open');
eq('reopening resets block state', rt2.getBlockState('inner'), 'normal');

// moving to another slide closes it
rt2.stepSlide(1);
eq('entering a slide closes the lightbox', rt2.getLightbox(), null);

// lightbox slides are out of normal navigation and completion
eq('Next skips the lightbox', new Runtime(proj()).effectiveSlides().map((s) => s.id), ['s0', 's1']);
eq('Next from s0 goes to s1, not the lightbox', (() => { const r = new Runtime(proj()); r.stepSlide(1); return r.getSnapshot().slideId; })(), 's1');
const done: any[] = [];
const rt3 = new Runtime(proj()); rt3.onTrack((e) => done.push(e));
rt3.enterSlide('s1');
eq('course completes without ever viewing the lightbox', done.some((e) => e.type === 'completed'), true);

// only flagged slides can be opened
const p = proj(); p.slides[2].lightbox = undefined;
const bad = new Runtime({ ...p, slides: [slide('s0', [blk('open')], [trig('onClick', [{ type: 'openLightbox', slideId: 's1' }], { sourceBlockId: 'open' })]), p.slides[2]] });
bad.clickBlock('open');
eq('a normal slide cannot be opened as a lightbox', bad.getLightbox(), null);

// validator
const pp = proj();
eq('valid lightbox target has no issues', slideTriggerIssues(pp.slides[0], pp).length, 0);
pp.slides[0].triggers[0].actions[0].slideId = 's1';   // exists, but isn't a lightbox
eq('pointing at a non-lightbox slide is flagged', slideTriggerIssues(pp.slides[0], pp).map((i) => i.missing), ['deleted']);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
