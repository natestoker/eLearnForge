// axe-core (WCAG A/AA) on the player and editor dialogs, plus keyboard and focus behaviour.
import { check, eq, finish, launch, demoProject, playerPage, editorPage, goToSlideWith, axeViolations } from './harness.mjs';

const browser = await launch();
const project = await demoProject(async (p, f) => {
  p.resources = [{ id: 'r1', title: 'Quick reference card', description: 'Print it.', url: 'https://example.com/card.pdf' }];
  p.glossary = [{ id: 'g1', term: 'Phishing', definition: 'A message that tricks you.' }];
  const lb = f.createSlide('Hint'); lb.lightbox = true; lb.width = 600; lb.height = 340;
  const ob = f.createBlock('button', 60, 560); ob.props.label = 'Open hint'; p.slides[0].layers[0].blocks.push(ob);
  const cb = f.createBlock('button', 200, 240); cb.props.label = 'Got it'; lb.layers[0].blocks.push(cb);
  lb.triggers.push({ id: 'c', event: 'onClick', sourceBlockId: cb.id, conditions: [], actions: [{ type: 'closeLightbox' }] });
  p.slides.push(lb);
  p.slides[0].triggers.push({ id: 'o', event: 'onClick', sourceBlockId: ob.id, conditions: [], actions: [{ type: 'openLightbox', slideId: lb.id }] });
});
const page = await playerPage(browser, project);

// ---- axe, state by state
eq('axe: first slide', await axeViolations(page), []);
await page.locator('.player-hamburger').click(); await page.waitForTimeout(400);
eq('axe: course menu open', await axeViolations(page), []);
await page.locator('.player-hamburger').click(); await page.waitForTimeout(300);
await page.locator('.player-info-btn', { hasText: 'Resources' }).click(); await page.waitForTimeout(300);
eq('axe: Resources panel', await axeViolations(page), []);
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
await page.locator('.player-block', { hasText: 'Open hint' }).click(); await page.waitForTimeout(300);
eq('axe: lightbox open', await axeViolations(page), []);
await page.keyboard.press('Escape'); await page.waitForTimeout(200);

// ---- slide change: focus goes to a heading naming the new slide
await page.locator('button:has-text("Next")').first().focus();
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
eq('after Next, focus is on the new slide heading', await page.evaluate(() => document.activeElement?.tagName + ': ' + document.activeElement?.textContent), 'H1: Spot the red flags, slide 2 of 6');

// ---- quiz: radio roles, state, and feedback focus
await goToSlideWith(page, '.mc-block');
eq('axe: quiz slide', await axeViolations(page), []);
eq('choices are radios inside a named group', [await page.locator('.mc-block').getAttribute('role'), await page.locator('.mc-choice.live').first().getAttribute('role')], ['group', 'radio']);
await page.locator('.mc-choice.live').first().focus();
await page.keyboard.press('Space');
eq('Space selects and reports checked', await page.locator('.mc-choice.live').first().getAttribute('aria-checked'), 'true');
await page.locator('.mc-submit.live').first().focus();
await page.keyboard.press('Enter'); await page.waitForTimeout(400);
check('after Submit, focus moves to the feedback', await page.evaluate(() => document.activeElement?.classList.contains('mc-feedback')));

// ---- drag and drop by keyboard: pick up, jump to Place, focus returns
await goToSlideWith(page, '.dd-block');
eq('axe: drag and drop slide', await axeViolations(page), []);
const item = page.locator('.dd-item').first();
await item.focus();
await page.keyboard.press('Enter'); await page.waitForTimeout(300);
check('picking an item up moves focus to a Place button', await page.evaluate(() => document.activeElement?.classList.contains('dd-place')));
await page.keyboard.press('Enter'); await page.waitForTimeout(400);
check('placing it returns focus to the item', await page.evaluate(() => document.activeElement?.classList.contains('dd-item')));
check('and says where it went', /placed in/.test(await page.locator('.dd-block .sr-only').innerText()));

// ---- editor dialogs
const ed = await editorPage(browser);
await ed.locator('.ribbon-tabs button').filter({ hasText: /^Triggers$/ }).click();
await ed.locator('.tp-summary').first().click(); await ed.waitForTimeout(300);
eq('axe: Triggers panel', await axeViolations(ed, '.tp-root'), []);
await ed.locator('button:has-text("Publish")').first().click(); await ed.waitForTimeout(400);
eq('axe: Publish dialog', await axeViolations(ed, '.pd-root'), []);

await browser.close();
finish();
