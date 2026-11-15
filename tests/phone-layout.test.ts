import { createDemoProject, createSlide, createBlock } from '../src/schema/factory';
import { phoneLayoutFor, reflowOrder, reflowFontScale, isDecorative } from '../src/runtime/phoneLayout';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : detail); };
const eq = (name: string, got: unknown, want: unknown) => check(name, JSON.stringify(got) === JSON.stringify(want), `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);

const demo = createDemoProject();
console.log(demo.slides.map((s) => `${s.name}: ${JSON.stringify(phoneLayoutFor(s))}`).join('\n'));

const at = (type: any, x: number, y: number, w = 200, h = 100) => { const b = createBlock(type, x, y); b.w = w; b.h = h; return b; };
{
  const s = createSlide('text'); s.layers[0].blocks = [at('text', 80, 80, 600, 80), at('text', 80, 200, 600, 200), at('multipleChoice', 80, 420, 500, 250)];
  eq('stacked text and a quiz reflow', phoneLayoutFor(s).mode, 'reflow');
  s.layers[0].blocks.push(at('hotspot', 300, 300));
  eq('a hotspot keeps the stage', phoneLayoutFor(s), { mode: 'fit', reason: 'it has a hotspot' });
  s.phoneLayout = 'reflow';
  eq('the author can force reflow', phoneLayoutFor(s).mode, 'reflow');
}
{
  const s = createSlide('overlap'); s.layers[0].blocks = [at('image', 0, 0, 800, 600), at('text', 100, 100, 400, 100)];
  eq('text over an image keeps the stage', phoneLayoutFor(s), { mode: 'fit', reason: 'blocks overlap' });
  s.phoneLayout = 'fit';
  eq('fit can be forced too', phoneLayoutFor(s).reason, 'set by the author');
}
{
  const s = createSlide('deco'); const shape = at('shape', 0, 0, 1280, 720); const text = at('text', 100, 100, 400, 100);
  s.layers[0].blocks = [shape, text];
  check('a plain background shape is decoration', isDecorative(shape, s));
  eq('so it does not count as an overlap', phoneLayoutFor(s).mode, 'reflow');
  s.triggers.push({ id: 't', event: 'onClick', sourceBlockId: shape.id, conditions: [], actions: [] } as any);
  check('a clickable shape is not decoration', !isDecorative(shape, s));
}
{
  const s = createSlide('motion'); const b = at('text', 0, 0); (b as any).motion = { vector: { x: 10, y: 0 } }; s.layers[0].blocks = [b];
  eq('a motion path keeps the stage', phoneLayoutFor(s).mode, 'fit');
}
{
  const a = at('text', 500, 100), b = at('text', 80, 110), c = at('text', 80, 300), d = at('text', 80, 20);
  eq('reading order is rows top to bottom, then left to right', reflowOrder([a, b, c, d]).map((x) => x.id), [d.id, b.id, a.id, c.id]);
}
eq('body text stays at 16px or more', [Math.round(14 * reflowFontScale(14)), Math.round(18 * reflowFontScale(18))], [16, 18]);
check('a 54px heading comes down to about 30px', Math.round(54 * reflowFontScale(54)) === 30, String(54 * reflowFontScale(54)));
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
