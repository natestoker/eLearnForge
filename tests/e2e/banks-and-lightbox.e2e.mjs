// Question banks draw per learner; lightbox slides open, animate and close.
import { check, eq, finish, launch, demoProject, playerPage } from './harness.mjs';

const browser = await launch();
const project = await demoProject(async (p, f) => {
  const lb = f.createSlide('Hint popup'); lb.lightbox = true; lb.width = 600; lb.height = 340;
  lb.timeline = { duration: 3, autoAdvance: false };
  const t = f.createBlock('text', 40, 40); t.props.html = '<p>This is the hint inside the lightbox.</p>';
  t.timing = { start: 0.6, animIn: { type: 'fade', duration: 1, ease: 'none' } };
  lb.layers[0].blocks.push(t);
  const cb = f.createBlock('button', 200, 240); cb.props.label = 'Got it'; lb.layers[0].blocks.push(cb);
  lb.triggers.push({ id: 'close', event: 'onClick', sourceBlockId: cb.id, conditions: [], actions: [{ type: 'closeLightbox' }] });
  p.slides.push(lb);
  const ob = f.createBlock('button', 60, 560); ob.props.label = 'Open hint'; p.slides[0].layers[0].blocks.push(ob);
  p.slides[0].triggers.push({ id: 'open', event: 'onClick', sourceBlockId: ob.id, conditions: [], actions: [{ type: 'openLightbox', slideId: lb.id }] });
  // slides 2-5 form a bank; each learner gets 2 of them, in random order
  p.banks = [{ id: 'bk', name: 'Practice', slideIds: p.slides.slice(1, 5).map((s) => s.id), draw: 2, shuffle: true }];
});

const menus = new Set();
let first;
for (let run = 0; run < 6; run++) {
  const page = await playerPage(browser, project);
  await page.locator('.player-hamburger').click(); await page.waitForTimeout(350);
  const items = await page.locator('.player-menu-label').allInnerTexts();
  menus.add(items.join('|'));
  if (run === 0) first = { page, items };
  else await page.context().close();
}
eq('every learner sees 4 slides: intro, 2 drawn from the bank, summary (lightbox hidden)', first.items.length, 4);
check('learners get different draws or orders', menus.size > 1, `only ${menus.size} distinct menu`);
check('the first and last slides stay put', first.items[0] === 'Welcome' && first.items[3] === 'Summary');

// ---- lightbox
const page = first.page;
await page.locator('.player-hamburger').click(); await page.waitForTimeout(300);
await page.locator('.player-block', { hasText: 'Open hint' }).click(); await page.waitForTimeout(150);
eq('the lightbox opens over the slide', await page.locator('.player-lightbox').count(), 1);
const opacity = () => page.evaluate(() => {
  const el = [...document.querySelectorAll('.player-lightbox .player-block')].find((e) => /hint inside/.test(e.textContent));
  return el ? Number(getComputedStyle(el).opacity) : null;
});
const early = await opacity();
await page.waitForTimeout(2000);
const late = await opacity();
check('its text fades in (animations play inside a lightbox)', early < 0.2 && late > 0.95, `early ${early}, late ${late}`);
await page.locator('.player-lightbox .player-block', { hasText: 'Got it' }).click(); await page.waitForTimeout(300);
eq('its own button closes it', await page.locator('.player-lightbox').count(), 0);
await page.locator('.player-block', { hasText: 'Open hint' }).click(); await page.waitForTimeout(300);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
eq('Escape closes it', await page.locator('.player-lightbox').count(), 0);

await browser.close();
finish();
