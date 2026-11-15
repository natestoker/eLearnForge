// The player at phone width: the transport fits, and the course menu floats over the slide.
import { check, eq, finish, launch, demoProject, playerPage, editorPage, goToSlideWith, axeViolations } from './harness.mjs';

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

// ---- Reflow: a quiz slide is one readable column on a phone
{
  await page.keyboard.press('Escape');
  check('reached the quiz', (await goToSlideWith(page, '.mc-choice.live')) > 0);
  await page.waitForTimeout(400);
  eq('the quiz slide reflows', await page.locator('.player-stage.reflow').count(), 1);
  const m = await page.evaluate(() => {
    const q = document.querySelector('.mc-choice.live'); const r = q.getBoundingClientRect();
    return { font: parseFloat(getComputedStyle(q).fontSize), h: r.height, right: r.right, left: r.left, scroll: document.documentElement.scrollWidth <= window.innerWidth };
  });
  check('answers are at least 16px text', m.font >= 16, JSON.stringify(m));
  check('answers are at least 44px tall', m.h >= 44, JSON.stringify(m));
  check('answers fit the screen width', m.left >= 0 && m.right <= 390 && m.scroll, JSON.stringify(m));
  const top = await page.evaluate(() => { const first = document.querySelector('.player-stage.reflow .player-block'); const tabs = document.querySelector('.player-info-tabs'); return first.getBoundingClientRect().top >= tabs.getBoundingClientRect().bottom - 1; });
  check('content starts below the floating buttons', top);
  await page.locator('.mc-choice.live').nth(0).tap();
  await page.locator('.mc-submit.live').first().tap();
  await page.waitForTimeout(400);
  check('answering works in the column', (await page.locator('.mc-feedback').count()) === 1);
  eq('the "Exactly right" note is not hidden from screen readers', await page.locator('.player-block[aria-hidden] .statement-block').count(), 0);
  eq('axe: reflowed quiz', await axeViolations(page), []);
}
// ---- Drag and drop: tap an item, then tap its pile
{
  check('reached drag and drop', (await goToSlideWith(page, '.dd-block')) > 0);
  await page.waitForTimeout(400);
  eq('drag and drop reflows', await page.locator('.player-stage.reflow').count(), 1);
  await page.locator('[data-dd-item]').first().tap();
  await page.waitForTimeout(300);
  const place = page.locator('.dd-place').first();
  check('tapping an item offers Place buttons', (await place.count()) === 1 || (await page.locator('.dd-place').count()) > 1);
  const ph = await place.boundingBox();
  check('Place buttons are at least 44px tall', ph && ph.height >= 44, JSON.stringify(ph));
  await place.tap();
  await page.waitForTimeout(300);
  check('the item was placed by tapping', (await page.locator('.dd-zone [data-dd-item], .dd-target [data-dd-item]').count()) >= 1 || (await page.locator('.dd-place').count()) === 0);
}
// ---- Fit view: a hotspot slide keeps the stage and says why, once
{
  const pg = await playerPage(browser, project, { viewport: { width: 390, height: 780 }, mobile: true });
  await pg.locator('button:has-text("Next")').first().tap(); await pg.waitForTimeout(600);
  eq('the hotspot slide is not reflowed', await pg.locator('.player-stage.reflow').count(), 0);
  check('it explains the wide layout', /Turn your phone sideways/.test(await pg.locator('.player-fit-hint').innerText()));
  await pg.locator('.player-fit-hint button').tap(); await pg.waitForTimeout(200);
  eq('the hint can be dismissed', await pg.locator('.player-fit-hint').count(), 0);
  await pg.context().close();
}
// ---- Landscape: the stage stays and the controls move to a side rail
{
  const pg = await playerPage(browser, project, { viewport: { width: 780, height: 390 }, mobile: true });
  await goToSlideWith(pg, '.mc-choice.live');
  eq('landscape keeps the 16:9 stage', await pg.locator('.player-stage.reflow').count(), 0);
  const bar = await pg.locator('.player-chrome-bar').boundingBox();
  const stage = await pg.locator('.player-stage-area').boundingBox();
  check('the controls are a rail at the side', bar && bar.width <= 90 && bar.height >= 300 && bar.x >= stage.x + stage.width - 1, JSON.stringify(bar));
  check('the slide gets the full height', stage && stage.height >= 380, JSON.stringify(stage));
  const nx = await pg.locator('.player-chrome-btn', { hasText: 'Next' }).boundingBox();
  check('Next in the rail is a 44px target', nx && nx.height >= 44, JSON.stringify(nx));
  await pg.context().close();
}
// ---- Portrait: one top bar with the position; a plain Continue button merges into Next
{
  const pg = await playerPage(browser, project, { viewport: { width: 390, height: 780 }, mobile: true });
  check('the top bar says where you are', /1 of 6 · Welcome/.test(await pg.locator('.player-topbar').innerText()));
  eq('the slide\'s own "Start the course" button is left to Next', await pg.locator('.player-stage.reflow .player-block', { hasText: 'Start the course' }).count(), 0);
  const tabs = await pg.locator('.player-info-tabs').boundingBox();
  check('Resources and Glossary sit in the top bar, not over the slide', tabs && tabs.y + tabs.height <= 52, JSON.stringify(tabs));
  await pg.context().close();
}
// ---- Editor: Preview > Phone shows the reflowed column, and the slide can override it
{
  const ed = await editorPage(browser);
  await ed.locator('.slide-item').nth(3).click();
  await ed.waitForTimeout(300);
  await ed.getByRole('button', { name: /Preview/ }).first().click();
  await ed.locator('.menu-item', { hasText: 'Phone: this slide' }).click();
  await ed.waitForTimeout(1200);
  eq('the phone preview reflows the quiz slide', await ed.locator('.preview-phone-frame .player-stage.reflow').count(), 1);
  const wrap = await ed.locator('.preview-phone-frame .player-chrome-bar').evaluate((el) => getComputedStyle(el).flexWrap);
  eq('the phone preview gets the phone chrome', wrap, 'wrap');
  await ed.keyboard.press('Escape'); await ed.waitForTimeout(300);
  await ed.locator('.canvas-area').click({ position: { x: 8, y: 8 } });
  const sel = ed.locator('.slide-props .field', { has: ed.locator('.field-label:text-is("On a phone held upright")') }).locator('select');
  check('Auto says what it will do', /Auto \(one column\)/.test(await sel.locator('option').first().innerText()));
  await sel.selectOption('fit');
  await ed.waitForTimeout(200);
  await ed.getByRole('button', { name: /Preview/ }).first().click();
  await ed.locator('.menu-item', { hasText: 'Phone: this slide' }).click();
  await ed.waitForTimeout(1200);
  eq('forcing Wide layout turns reflow off for that slide', await ed.locator('.preview-phone-frame .player-stage.reflow').count(), 0);
  await ed.context().close();
}

await browser.close();
finish();
