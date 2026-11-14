import { Runtime } from '../src/engine/runtime';
import { createForge, runAuthorJs } from '../src/engine/forge';
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
};
const blk = (id: string) => ({ id, type: 'text', props: {} }) as any;
const slide = (id: string, triggers: any[] = []) => ({ id, name: id, width: 1, height: 1, triggers,
  layers: [{ id: 'l_' + id, name: 'base', visibleByDefault: true, blocks: [blk('b_' + id)] }] });
const mk = (slides: any[], variables: any[] = []) => ({ id: 'p', title: 't', variables, slides }) as any;
const trig = (event: string, actions: any[], extra: any = {}) => ({ id: 't' + Math.random(), event, conditions: [], actions, ...extra });
const cur = (rt: Runtime) => rt.getSnapshot().slideId;

// next / prev stop at the ends
let rt = new Runtime(mk([slide('s0', [trig('onKeyPress', [{ type: 'nextSlide' }], { key: 'ArrowRight' }), trig('onKeyPress', [{ type: 'prevSlide' }], { key: 'ArrowLeft' })]), slide('s1'), slide('s2')]));
eq('prev on first slide is a no-op', (rt.keyPress('ArrowLeft'), cur(rt)), 's0');
eq('ArrowRight -> next slide', (rt.keyPress('ArrowRight'), cur(rt)), 's1');
rt.stepSlide(1); rt.stepSlide(1);
eq('next on last slide is a no-op', cur(rt), 's2');
rt.stepSlide(-1);
eq('stepSlide back', cur(rt), 's1');

// key matching
rt = new Runtime(mk([slide('s0', [trig('onKeyPress', [{ type: 'setScore', score: 10 }], { key: 'a' }), trig('onKeyPress', [{ type: 'setScore', score: 20 }], { key: ' ' })])]));
eq('unmatched key returns false', rt.keyPress('z'), false);
eq('matched key returns true', rt.keyPress('a'), true);
eq('uppercase A matches a', (rt.keyPress('A'), rt.getScore()), 10);
eq('space matches', (rt.keyPress(' '), rt.getScore()), 20);
eq('trigger without key never fires', new Runtime(mk([slide('s0', [trig('onKeyPress', [{ type: 'completeCourse' }])])])).keyPress('Enter'), false);
eq('key trigger on another slide does not fire', (() => { const r = new Runtime(mk([slide('s0'), slide('s1', [trig('onKeyPress', [{ type: 'completeCourse' }], { key: 'Enter' })])])); return r.keyPress('Enter'); })(), false);

// resetBlock / resetVariable
const vars = [{ id: 'v1', name: 'n', type: 'number', defaultValue: 5 }];
rt = new Runtime(mk([slide('s0', [
  trig('onKeyPress', [{ type: 'hideBlock', blockId: 'b_s0' }, { type: 'setState', blockId: 'b_s0', state: 'disabled' }, { type: 'setVariable', variableId: 'v1', value: 99 }], { key: 'h' }),
  trig('onKeyPress', [{ type: 'resetBlock', blockId: 'b_s0' }, { type: 'resetVariable', variableId: 'v1' }], { key: 'r' })])], vars));
rt.keyPress('h');
eq('hidden + disabled + changed', [rt.isBlockVisible('b_s0'), rt.getBlockState('b_s0'), rt.variableById('v1')], [false, 'disabled', 99]);
rt.keyPress('r');
eq('reset restores visibility, state, default', [rt.isBlockVisible('b_s0'), rt.getBlockState('b_s0'), rt.variableById('v1')], [true, 'normal', 5]);

// resetVariable fires onVariableChange triggers
rt = new Runtime(mk([slide('s0', [
  trig('onVariableChange', [{ type: 'setScore', score: 42 }], { watchVariableId: 'v1' }),
  trig('onKeyPress', [{ type: 'setVariable', variableId: 'v1', value: 9 }], { key: 'x' }),
  trig('onKeyPress', [{ type: 'resetVariable', variableId: 'v1' }], { key: 'y' })])], vars));
rt.keyPress('x'); (rt as any).lastScore = 0; (rt as any).scoreSet = false;
rt.keyPress('y');
eq('resetVariable triggers onVariableChange', rt.getScore(), 42);

// restartSlide: re-enters, resets layers/states, rewinds the clock, and never loops forever
rt = new Runtime(mk([slide('s0', [
  trig('onKeyPress', [{ type: 'hideBlock', blockId: 'b_s0' }], { key: 'h' }),
  trig('onKeyPress', [{ type: 'restartSlide' }], { key: 'r' })])]));
const effects: any[] = []; rt.onEffect((a) => effects.push(a));
rt.keyPress('h'); rt.keyPress('r');
eq('restartSlide resets visibility', rt.isBlockVisible('b_s0'), true);
eq('restartSlide asks the player to rewind', effects.map(e => e.type), ['restartTimeline']);
const loopy = new Runtime(mk([slide('s0', [trig('onSlideLoad', [{ type: 'restartSlide' }])])]));
eq('restartSlide inside onSlideLoad stops at the depth cap', loopy.currentSlide().id, 's0');

// executeJs / exitCourse go to the player as effects
rt = new Runtime(mk([slide('s0', [trig('onKeyPress', [{ type: 'executeJs', code: 'x' }, { type: 'exitCourse' }], { key: 'e' })])]));
const fx: any[] = []; rt.onEffect((a) => fx.push(a));
rt.keyPress('e');
eq('executeJs and exitCourse reach the player', fx.map(a => a.type), ['executeJs', 'exitCourse']);

// author JS: forge API works, errors are swallowed
rt = new Runtime(mk([slide('s0'), slide('s1'), slide('s2')], [{ id: 'v1', name: 'count', type: 'number', defaultValue: 0 }]));
runAuthorJs('forge.setVariable("count", forge.getVariable("count") + 7); forge.nextSlide(); forge.goToSlide(3);', createForge(rt), {});
eq('forge set/get/goToSlide', [rt.variableById('v1'), cur(rt)], [7, 's2']);
const origErr = console.error; let logged = 0; console.error = () => { logged++; };
runAuthorJs('throw new Error("boom")', createForge(rt), {});
runAuthorJs('this is not js', createForge(rt), {});
console.error = origErr;
eq('script errors are logged, not thrown', logged, 2);
rt.completeCourse();
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
