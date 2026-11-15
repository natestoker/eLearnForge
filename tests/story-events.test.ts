import { Runtime } from '../src/engine/runtime';
import { md5 } from '../src/publish/md5';
import { partId } from '../src/publish/storyExport';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
};
const bytes = (s: string) => new TextEncoder().encode(s);

// MD5 (Storyline links pictures to files by it): RFC 1321 test vectors.
eq('md5 of nothing', md5(bytes('')), 'd41d8cd98f00b204e9800998ecf8427e');
eq('md5 of "abc"', md5(bytes('abc')), '900150983cd24fb0d6963f7d28e17f72');
eq('md5 across a block boundary', md5(bytes('12345678901234567890123456789012345678901234567890123456789012345678901234567890')), '57edf4a22be3c955ac49da2e2107b67a');
eq('md5 of 1000 bytes', md5(new Uint8Array(1000).fill(97)), 'cabe45dcc9ae5b66ba86600cca6b8ba8');

// Storyline names a part after its object's GUID. Both pairs are from real files.
eq('slide part id from its GUID', partId('bb5e5c75-693a-43de-8898-b8e2268ef0de'), 'R5pGMn2y5GAn');
eq('picture file name from its asset GUID', partId('f5555113-ee7b-4aba-8a2b-8ef27e8de89f'), 'R6Pmne65aeQt');

const trig = (event: string, actions: unknown[], extra: object = {}) => ({ id: 't' + Math.random(), event, conditions: [], actions, ...extra });
const vars = [{ id: 'v', name: 'n', type: 'number', defaultValue: 0 }, { id: 'ok', name: 'ok', type: 'boolean', defaultValue: false }];
const slide = (id: string, triggers: unknown[] = []) => ({
  id, name: id, width: 1, height: 1, triggers,
  layers: [
    { id: 'base_' + id, name: 'base', visibleByDefault: true, blocks: [{ id: 'b_' + id, type: 'text', props: {} }] },
    { id: 'pop_' + id, name: 'pop', visibleByDefault: false, blocks: [] }
  ]
});
const mk = (slides: unknown[]) => ({ id: 'p', title: 't', variables: vars, slides }) as never;
const cur = (rt: Runtime) => rt.getSnapshot().slideId;

// onLayerShown: once per hidden -> shown, and only for its own layer
{
  const rt = new Runtime(mk([slide('s0', [
    trig('onClick', [{ type: 'showLayer', layerId: 'pop_s0' }], { sourceBlockId: 'b_s0' }),
    trig('onLayerShown', [{ type: 'adjustVariable', variableId: 'v', delta: 1 }], { layerId: 'pop_s0' }),
    trig('onLayerShown', [{ type: 'adjustVariable', variableId: 'v', delta: 100 }], { layerId: 'something_else' }),
    trig('onKeyPress', [{ type: 'hideLayer', layerId: 'pop_s0' }], { key: 'h' })
  ])]));
  rt.clickBlock('b_s0');
  eq('showing a layer runs its "layer is shown" trigger', rt.variableById('v'), 1);
  rt.clickBlock('b_s0');
  eq('showing it again while it is up does nothing', rt.variableById('v'), 1);
  rt.keyPress('h'); rt.clickBlock('b_s0');
  eq('hide then show runs it again', rt.variableById('v'), 2);
}

// onNext / onBack take the player buttons over when their conditions pass
{
  const rt = new Runtime(mk([
    slide('s0', [
      trig('onNext', [{ type: 'goToSlide', slideId: 's2' }], { conditions: [{ variableId: 'ok', operator: 'eq', value: true }] }),
      trig('onKeyPress', [{ type: 'setVariable', variableId: 'ok', value: true }], { key: 'k' })
    ]),
    slide('s1'),
    slide('s2', [trig('onBack', [{ type: 'goToSlide', slideId: 's0' }])])
  ]));
  eq('Next has a trigger on this slide', rt.hasNavTrigger(1), true);
  eq('Next is not handled while the condition fails', rt.pressNav(1), false);
  rt.keyPress('k');
  eq('Next is handled once the condition passes', [rt.pressNav(1), cur(rt)], [true, 's2']);
  eq('Back follows its own trigger', [rt.pressNav(-1), cur(rt)], [true, 's0']);
  eq('a slide with no nav trigger leaves the buttons alone', (rt.enterSlide('s1'), [rt.hasNavTrigger(1), rt.pressNav(1)]), [false, false]);
  eq('a switched-off trigger does not count', new Runtime(mk([slide('s0', [trig('onNext', [{ type: 'completeCourse' }], { enabled: false })])])).hasNavTrigger(1), false);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
