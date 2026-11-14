// The player at phone width: the transport fits, and the course menu floats over the slide.
import { check, eq, finish, launch, demoProject, playerPage } from './harness.mjs';

const browser = await launch();
const project = await demoProject((p) => {
  p.resources = [{ id: 'r1', title: 'Card', description: '', url: 'https://example.com' }];
  p.glossary = [{ id: 'g1', term: 'Phishing', definition: 'A message that tricks you.' }];
});
const page = await playerPage(browser, project, { viewport: { width: 390, height: 780 }, mobile: true });

eq('no horizontal scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
const seek = await page.locator('.player-seek').boundingBox();
check('the seek bar sits inside the screen', seek && seek.x >= 0 && seek.x + seek.width <= 390, JSON.stringify(seek));
const next = await page.locator('button:has-text("Next")').first().boundingBox();
check('Next is on screen and big enough to tap', next && next.x + next.width <= 390 && next.height >= 36, JSON.stringify(next));

await page.locator('.player-hamburger').tap(); await page.waitForTimeout(450);
const nav = await page.locator('.player-sidenav').boundingBox();
check('the menu floats over the slide, not wider than the screen', nav && nav.width <= 390 * 0.9, JSON.stringify(nav));
eq('Resources and Glossary buttons are hidden while the menu is open', await page.locator('.player-info-tabs').isVisible(), false);
await page.locator('.player-hamburger').tap(); await page.waitForTimeout(300);

await page.locator('.player-info-btn', { hasText: 'Glossary' }).tap(); await page.waitForTimeout(350);
const panel = await page.locator('.player-info-panel').boundingBox();
check('the Glossary panel fits the screen', panel && panel.x >= 0 && panel.x + panel.width <= 391, JSON.stringify(panel));

await browser.close();
finish();
