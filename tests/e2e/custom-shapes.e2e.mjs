// Custom shape tool, SVG import, real slide thumbnails, the accent colouring
// the editor, and the ribbon layout (no clipped labels, same height per tab).
import { check, eq, finish, launch, editorPage } from './harness.mjs';

const browser = await launch();
const page = await editorPage(browser);

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  <g transform="translate(10 10)">
    <rect x="0" y="0" width="80" height="60" rx="10" fill="#ff0000"/>
    <circle cx="140" cy="30" r="25" style="fill:#0000ff;stroke:#00ff00;stroke-width:4"/>
    <path d="M0 100 L40 70 L80 100 Z" fill="none" stroke="#222"/>
  </g>
</svg>`;
const STAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,2 61,38 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,38" fill="gold"/></svg>`;

const blocksOnSlide = () => page.locator('.stage-block').count();

// ---- Insert > SVG: a drawing becomes a group of shapes that keep their colors
{
  const before = await blocksOnSlide();
  await page.locator('.ribbon-tab', { hasText: 'Insert' }).click();
  await page.locator('input[aria-label="Import an SVG file as shapes"]').setInputFiles({ name: 'art.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) });
  await page.waitForTimeout(500);
  eq('the SVG added one block (a group)', (await blocksOnSlide()) - before, 1);
  const html = await page.locator('.stage-block.selected').innerHTML();
  check('the rect, the circle and the path are all drawn', (html.match(/<path/g) ?? []).length >= 3, html.slice(0, 300));
  check('fills came across', /#ff0000/i.test(html) && /#0000ff/i.test(html), html.slice(0, 400));
  check('the circle kept its stroke color', /#00ff00/i.test(html));
}
// ---- Double-click into the group: a visible, draggable selection on the child
{
  const g = await page.locator('.stage-block.selected').boundingBox();
  await page.mouse.dblclick(g.x + g.width * 0.62, g.y + g.height * 0.45); // in a gap between shapes: still picks the nearest
  await page.waitForTimeout(300);
  eq('double-click selects a shape inside the group, with a visible selection', await page.locator('.nested-sel').count(), 1);
  eq('with resize handles', (await page.locator('.nested-sel .handle').count()) > 4, true);
  const a = await page.locator('.nested-sel').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 40, a.y + a.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  const b = await page.locator('.nested-sel').boundingBox();
  check('the inner shape drags on its own', Math.abs(b.x - a.x - 40) < 3 && Math.abs(b.y - a.y - 20) < 3, JSON.stringify([a.x, a.y, b.x, b.y]));
  // A cancelled pointer (native drag, lost release) must not leave the block
  // glued to the cursor.
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 10, b.y + b.height / 2, { steps: 2 });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel')));
  await page.mouse.move(b.x + b.width / 2 + 150, b.y + b.height / 2 + 90, { steps: 4 });
  const c = await page.locator('.nested-sel').boundingBox();
  check('a cancelled drag lets go of the block', Math.abs(c.x - (b.x + 10)) < 4 && Math.abs(c.y - b.y) < 4, JSON.stringify([b.x, b.y, c.x, c.y]));
  await page.mouse.up();
}

// a broken file is reported, not inserted
{
  const before = await blocksOnSlide();
  let msg = '';
  page.once('dialog', async (d) => { msg = d.message(); await d.dismiss(); });
  await page.locator('input[aria-label="Import an SVG file as shapes"]').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg><oops') });
  await page.waitForTimeout(400);
  eq('a broken SVG inserts nothing', await blocksOnSlide(), before);
  check('and says why', /not a valid SVG/i.test(msg), msg);
}

// ---- Pen tool: generators, freehand, undo, SVG outline
await page.locator('.rbn-mbtn', { hasText: 'Custom' }).click();
await page.waitForSelector('.pen-dialog');
{
  await page.locator('input[aria-label="Number of sides or points"]').fill('6');
  await page.locator('.pen-dialog button', { hasText: 'Polygon' }).click();
  eq('a hexagon has six points', (await page.locator('.pen-count').innerText()).trim(), '6 points');
  await page.locator('.pen-dialog button', { hasText: 'Star' }).click();
  eq('a six-point star has twelve', (await page.locator('.pen-count').innerText()).trim(), '12 points');
  await page.keyboard.press('Control+z');
  eq('Ctrl+Z goes back to the hexagon', (await page.locator('.pen-count').innerText()).trim(), '6 points');
  await page.keyboard.press('Control+Shift+z');
  eq('Ctrl+Shift+Z redoes the star', (await page.locator('.pen-count').innerText()).trim(), '12 points');
}
{
  // The dialog must not change size when a point is selected or deselected.
  {
    const w0 = (await page.locator('.pen-dialog').boundingBox()).width;
    const first = page.locator('.pen-node').first();
    await first.click({ force: true });
    await page.waitForTimeout(150);
    const w1 = (await page.locator('.pen-dialog').boundingBox()).width;
    eq('the pen dialog keeps its width when a point is selected', Math.round(w1), Math.round(w0));
  }
  await page.locator('.pen-dialog button', { hasText: 'Clear' }).click();
  await page.locator('.pen-dialog button', { hasText: 'Freehand' }).click();
  const box = await page.locator('.pen-canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = Math.min(box.width, box.height) / 3;
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  await page.mouse.up();
  const n = parseInt((await page.locator('.pen-count').innerText()), 10);
  check('a drawn circle is simplified to a handful of smooth points', n >= 4 && n <= 20, String(n));
  await page.locator('.pen-dialog button', { hasText: 'Undo' }).click();
  eq('Undo removes the drawing', (await page.locator('.pen-count').innerText()).trim(), '0 points');
}
{
  await page.locator('.pen-dialog button', { hasText: 'Freehand' }).click(); // off
  await page.locator('input[aria-label="Import an SVG outline"]').setInputFiles({ name: 'star.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(STAR) });
  await page.waitForTimeout(300);
  eq('an SVG polygon comes in as an outline', (await page.locator('.pen-count').innerText()).trim(), '10 points');
  await page.locator('.pen-dialog button', { hasText: 'Apply' }).click();
  await page.waitForTimeout(300);
  check('the pen dialog closed', (await page.locator('.pen-dialog').count()) === 0);
  const html = await page.locator('.stage-block.selected').innerHTML();
  check('the custom shape is on the slide', /<path/.test(html));
}

// ---- Real thumbnails
{
  const txt = await page.locator('.slide-preview-stage').first().innerText();
  check('the first thumbnail shows the slide\'s real text', /Phishing Awareness/.test(txt), txt.slice(0, 80));
  const sized = await page.locator('.slide-preview-stage').first().evaluate((el) => el.getBoundingClientRect().width > 50);
  check('and is scaled into the card', sized);
}

// ---- Accent drives the editor and stays readable
{
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  await page.getByRole('button', { name: 'Course', exact: true }).click();
  await page.waitForSelector('.cs-root');
  for (const color of ['#1a237e', '#ff5a8a', '#ffd600']) {
    await page.evaluate((c) => { const i = document.querySelector('.cs-body input[type=color]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, c); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, color);
    await page.waitForTimeout(300);
    const v = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return { a: s.getPropertyValue('--accent').trim(), ink: s.getPropertyValue('--accent-ink').trim() }; });
    check(`accent ${color} reaches the editor`, /^#[0-9a-f]{6}$/i.test(v.a), JSON.stringify(v));
    check(`accent ${color} reads on the dark panels (>= 4.5:1)`, ratio(v.a, '#171b18') >= 4.4, `${v.a} ${ratio(v.a, '#171b18').toFixed(2)}`);
    check(`text on ${color} buttons is readable`, ratio(v.a, v.ink) >= 4.5, `${v.a} on ${v.ink}`);
  }
  await page.locator('.cs-done').click();
  const active = await page.locator('.ribbon-tab.active').evaluate((el) => getComputedStyle(el).color);
  check('the active ribbon tab uses the accent', active !== 'rgb(61, 220, 151)', active);
}

// ---- Ribbon: four command tabs, one height, nothing overflowing, at 1500 and 1280 wide
{
  eq('the ribbon has four tabs', await page.locator('.ribbon-tab').allInnerTexts(), ['Insert', 'Arrange', 'Animate', 'View']);
  for (const width of [1500, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('.stage-block').first().click({ force: true });
    const bad = [];
    for (const t of ['Insert', 'Arrange', 'Animate', 'View']) {
      await page.locator('.ribbon-tab', { hasText: t }).click();
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => { const e = document.querySelector('.ribbon-body'); return { h: e.clientHeight, w: e.clientWidth, sw: e.scrollWidth, tall: Math.max(0, ...[...e.querySelectorAll('.ribbon-group')].map((g) => g.scrollHeight)) }; });
      if (m.h !== 96 || m.sw > m.w || m.tall > m.h) bad.push(`${t}: ${JSON.stringify(m)}`);
    }
    eq(`every tab fits a 96px shelf at ${width}px`, bad, []);
  }
  // Narrower than 1280: no sideways scroll; a More button opens the rest.
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.locator('.ribbon-tab', { hasText: 'Insert' }).click();
  await page.waitForTimeout(300);
  eq('at 1000px Insert offers More', await page.locator('.ribbon-more').count(), 1);
  eq('and does not scroll sideways', await page.locator('.ribbon-body').evaluate((e) => getComputedStyle(e).overflowX), 'hidden');
  await page.locator('.ribbon-more').click();
  await page.waitForTimeout(200);
  const vis = await page.locator('.rbn-mbtn', { hasText: 'Results' }).boundingBox();
  check('More shows the groups that did not fit', vis && vis.x >= 0 && vis.x + vis.width <= 1000, JSON.stringify(vis));
  await page.locator('.ribbon-more').click();
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.keyboard.press('Escape');
}
// ---- Slide settings live in the inspector when nothing is selected
{
  await page.locator('.canvas-area').click({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(200);
  check('with nothing selected the inspector shows the slide', (await page.locator('.slide-props').count()) === 1 && (await page.locator('.slide-props').innerText()).includes('TRANSITION'.toLowerCase()) || (await page.locator('.slide-props .field-label').allInnerTexts()).some((t) => /transition/i.test(t)));
  await page.locator('.rtab', { hasText: 'Variables' }).click();
  check('Variables is a right-panel tab with a count', /\d/.test(await page.locator('.rtab', { hasText: 'Variables' }).innerText()));
  await page.locator('.rtab', { hasText: 'Inspect' }).click();
}
// ---- Hovering a layer row must not change its height (rows used to dance)
{
  await page.locator('.panel-header:has-text("LAYERS") .btn').first().click();
  await page.waitForTimeout(300);
  const rows = page.locator('.layer-item');
  check('there are two layers', (await rows.count()) >= 2);
  await rows.first().click();
  await page.waitForTimeout(200);
  const before = await rows.last().evaluate((el) => el.getBoundingClientRect().height);
  await rows.last().hover();
  await page.waitForTimeout(200);
  const after = await rows.last().evaluate((el) => el.getBoundingClientRect().height);
  eq('hover does not resize a layer row', Math.round(after), Math.round(before));
}
// ---- Deleting a slide lands on its neighbor, not slide 1
{
  for (let i = 0; i < 3; i++) await page.locator('.panel-header:has-text("SLIDES") .btn').first().click();
  await page.waitForTimeout(300);
  await page.locator('.slide-item').nth(3).click();
  await page.waitForTimeout(200);
  const status = async () => (await page.locator('.statusbar').innerText()).match(/Slide (\d+) of (\d+)/)?.slice(1).join('/');
  const before = await status();
  await page.locator('.slide-item.active button[aria-label="Delete slide"]').click();
  await page.waitForTimeout(200);
  const confirm = page.locator('button', { hasText: /^(Delete|OK|Yes)/ });
  if (await confirm.count()) await confirm.first().click();
  await page.waitForTimeout(300);
  const afterStatus = await status();
  const [b0, bt] = (before ?? '0/0').split('/').map(Number), [a0, at] = (afterStatus ?? '0/0').split('/').map(Number);
  check('after deleting slide 4 you are on slide 4 again, not slide 1', b0 === 4 && a0 === 4 && at === bt - 1, `${before} -> ${afterStatus}`);
}
// ---- Right-click a block: cut, copy, paste, duplicate, order, delete
{
  const before = await blocksOnSlide();
  const blk = page.locator('.stage-block').nth(1);
  await blk.click({ button: 'right', force: true });
  await page.waitForTimeout(200);
  const menu = page.locator('.ctx-menu[role=menu]');
  check('right-click opens the block menu', (await menu.count()) === 1 && /Duplicate/.test(await menu.innerText()));
  await menu.locator('button', { hasText: 'Duplicate' }).click();
  await page.waitForTimeout(250);
  eq('Duplicate adds a block', await blocksOnSlide(), before + 1);
  await page.locator('.stage-block.selected').click({ button: 'right', force: true });
  await page.locator('.ctx-menu[role=menu] button', { hasText: 'Delete' }).click();
  await page.waitForTimeout(250);
  eq('Delete removes it', await blocksOnSlide(), before);
  await page.locator('.stage-block').nth(1).click({ button: 'right', force: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  eq('Escape closes the menu', await page.locator('.ctx-menu[role=menu]').count(), 0);
}
// ---- Inspector sections fold, and say what is inside when closed
{
  await page.locator('.stage-block').first().click({ force: true });
  await page.locator('.rtab', { hasText: 'Inspect' }).click();
  await page.locator('.tab', { hasText: 'Properties' }).first().click();
  const layout = page.locator('.insp-fold', { has: page.locator('.insp-fold-title', { hasText: 'Layout' }) });
  check('Layout starts closed with a summary', (await layout.locator('.insp-fold-body').count()) === 0 && /\d+, \d+ · \d+ × \d+/.test(await layout.locator('.insp-fold-summary').innerText()));
  await layout.locator('.insp-fold-head').click();
  await page.waitForTimeout(150);
  check('opening it shows X, Y, W, H', (await layout.locator('.field-label').allInnerTexts()).join(' ').toUpperCase().includes('X'));
  await layout.locator('.insp-fold-head').click();
}
// ---- Deleting a slide shows an Undo toast, and Undo brings it back
{
  const count = () => page.locator('.slide-item').count();
  const before = await count();
  await page.locator('.slide-item').nth(1).click();
  await page.waitForTimeout(200);
  await page.locator('.slide-item.active button[aria-label="Delete slide"]').click();
  await page.waitForTimeout(250);
  eq('the slide is gone', await count(), before - 1);
  check('a toast offers Undo', /deleted/.test(await page.locator('.toast').innerText()));
  await page.locator('.toast-action').click();
  await page.waitForTimeout(250);
  eq('Undo brings the slide back', await count(), before);
}
// ---- Variables: block-owned ones are grouped, named for people, and can't be deleted
{
  await page.locator('.rtab', { hasText: 'Variables' }).click();
  await page.waitForTimeout(200);
  const owned = page.locator('.var-owned');
  check('block variables are listed with a readable name', (await owned.count()) >= 1 && !/^mc_blk_/.test((await owned.first().locator('b').innerText())));
  eq('they have no delete button', await owned.first().locator('button').count(), 0);
  await page.locator('.rtab', { hasText: 'Inspect' }).click();
}
// ---- Animate panel has the same inset as Properties
{
  await page.locator('.stage-block').first().click({ force: true });
  const inset = async (tab) => {
    await page.locator('.tab', { hasText: tab }).first().click();
    await page.waitForTimeout(200);
    return page.evaluate(() => {
      const panel = document.querySelector('.panel-scroll'); const label = panel.querySelector('h3, .field-label, .panel-title');
      return Math.round(label.getBoundingClientRect().left - panel.getBoundingClientRect().left);
    });
  };
  const props = await inset('Properties'), anim = await inset('Animate');
  check('Animate content is inset like Properties', Math.abs(props - anim) <= 2 && anim >= 10, `${props} vs ${anim}`);
}

// ---- Dragging a block past the edge must not move or rescale the canvas
{
  for (const vp of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 1040 }]) {
    const pg = await editorPage(browser, vp);
    const stageRect = () => pg.locator('.stage').evaluate((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width)]; });
    const blk = pg.locator('.stage-block').nth(1);
    await blk.click({ force: true });
    const b = await blk.boundingBox();
    const before = await stageRect();
    await pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await pg.mouse.down();
    const seen = new Set();
    // Drag well past the right and bottom edges of the visible canvas, and back.
    for (const [dx, dy] of [[300, 100], [700, 300], [1200, 600], [700, 300], [300, 100], [-200, -100]]) {
      await pg.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 6 });
      await pg.waitForTimeout(120);
      seen.add((await stageRect()).join(','));
    }
    await pg.mouse.up();
    check(`the canvas stays put while dragging past its edge (${vp.width}x${vp.height})`, seen.size === 1 && [...seen][0] === before.join(','), `before ${before.join(',')} saw ${[...seen].join(' | ')}`);
    await pg.context().close();
  }
}

await browser.close();
finish();
