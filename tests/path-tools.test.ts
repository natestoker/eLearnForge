import { arcToCubics, boundsOf, freehandToNodes, normalizeNodes, parsePathData, parseTransform, polygonNodes, simplifyRDP, starNodes, transformNodes } from '../src/blocks/shape/pathTools';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : detail); };
const eq = (name: string, got: unknown, want: unknown) => check(name, JSON.stringify(got) === JSON.stringify(want), `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
const finish = () => { console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0); };

const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e;

// lines, relative moves, H/V and close
{
  const s = parsePathData('M10 10 L 90 10 v 80 h -80 z');
  eq('one closed subpath of four corners', [s.length, s[0].closed, s[0].nodes.length], [1, true, 4]);
  eq('relative v/h land on the right corners', s[0].nodes.map((n) => [n.x, n.y]), [[10, 10], [90, 10], [90, 90], [10, 90]]);
}
// close that returns to the start merges into it
{
  const s = parsePathData('M0 0 L10 0 L10 10 L0 0 Z');
  eq('a closing line back to the start is merged', s[0].nodes.length, 3);
}
// multiple subpaths and implicit lineto after M
{
  const s = parsePathData('M0 0 10 0 10 10 Z M20 20 L30 20 L30 30 Z');
  eq('two subpaths', s.map((x) => x.nodes.length), [3, 3]);
}
// cubic: handles are carried on the anchors
{
  const s = parsePathData('M0 0 C 0 50, 50 100, 100 100 L 0 100 Z');
  eq('cubic keeps its control points', [s[0].nodes[0].h2, s[0].nodes[1].h1], [{ x: 0, y: 50 }, { x: 50, y: 100 }]);
}
// quadratic is raised to an equivalent cubic
{
  const s = parsePathData('M0 0 Q 50 100 100 0 L 50 -20 Z');
  const h2 = s[0].nodes[0].h2!, h1 = s[0].nodes[1].h1!;
  check('quadratic control points are 2/3 of the way', near(h2.x, 100 / 3) && near(h2.y, 200 / 3) && near(h1.x, 200 / 3) && near(h1.y, 200 / 3));
}
// smooth cubic reflects the previous handle
{
  const s = parsePathData('M0 0 C 0 10, 10 20, 20 20 S 40 10, 40 0 Z');
  const h2 = s[0].nodes[1].h2!;
  check('S reflects the previous second control point', near(h2.x, 30) && near(h2.y, 20), JSON.stringify(h2));
}
// arc: a half circle ends where it should and stays on the circle
{
  const segs = arcToCubics(0, 0, 50, 50, 0, 0, 1, 100, 0);
  const end = segs[segs.length - 1].p;
  check('arc ends at its endpoint', near(end.x, 100) && near(end.y, 0));
  check('arc is split into quarter turns', segs.length === 2);
  check('arc midpoint is on the circle', near(Math.hypot(segs[0].p.x - 50, segs[0].p.y), 50, 1e-6), JSON.stringify(segs[0].p));
}
// packed arc flags
{
  const s = parsePathData('M0 0 a10 10 0 011 10 z');
  check('packed arc flags parse', s.length === 1 && s[0].nodes.length >= 2);
}
// errors are thrown, not swallowed
{
  let threw = false;
  try { parsePathData('M 10 X'); } catch { threw = true; }
  check('garbage path data throws', threw);
}
// transforms
{
  const m = parseTransform('translate(10 20) scale(2)');
  const out = transformNodes([{ x: 1, y: 1 }], m);
  eq('translate then scale', [out[0].x, out[0].y], [12, 22]);
  const r = transformNodes([{ x: 10, y: 0 }], parseTransform('rotate(90)'));
  check('rotate 90', near(r[0].x, 0) && near(r[0].y, 10), JSON.stringify(r[0]));
}
// normalize into 0..100
{
  const nodes = [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 50 }];
  const out = normalizeNodes(nodes, boundsOf(nodes));
  eq('normalized to the full box', out.map((n) => [n.x, n.y]), [[0, 0], [100, 0], [100, 100]]);
  const inset = normalizeNodes(nodes, boundsOf(nodes), { x: 10, y: 20, w: 50, h: 50 });
  eq('normalized into a sub-rectangle', [inset[0].x, inset[0].y, inset[2].x, inset[2].y], [10, 20, 60, 70]);
}
// freehand
{
  const line = Array.from({ length: 50 }, (_, i) => ({ x: i * 2, y: 10 + (i % 2) * 0.1 }));
  eq('a near-straight run collapses to its endpoints', simplifyRDP(line, 1).length, 2);
  const circle = Array.from({ length: 80 }, (_, i) => ({ x: 50 + 30 * Math.cos((i / 80) * 6.2832), y: 50 + 30 * Math.sin((i / 80) * 6.2832) }));
  const nodes = freehandToNodes(circle, 1)!;
  check('a drawn circle becomes a few smooth anchors', nodes.length >= 4 && nodes.length < 30 && nodes.every((n) => n.smooth && n.h1 && n.h2), `${nodes?.length}`);
  eq('a click is not a shape', freehandToNodes([{ x: 1, y: 1 }, { x: 1, y: 1 }], 1), null);
}
// generators
{
  const p = polygonNodes(6);
  eq('hexagon has six points', p.length, 6);
  check('polygon starts at the top', near(p[0].x, 50) && near(p[0].y, 0));
  const s = starNodes(5, 0.5);
  eq('a 5-point star has ten anchors', s.length, 10);
  check('star inner radius', near(Math.hypot(s[1].x - 50, s[1].y - 50), 25));
  eq('sides are clamped', [polygonNodes(1).length, polygonNodes(99).length], [3, 24]);
}
finish();
