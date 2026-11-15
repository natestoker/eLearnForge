// Preview only: the live values panel, and Alt+click on a layer's eye to isolate it.
import { check, eq, finish, launch, editorPage, axeViolations } from './harness.mjs';

const browser = await launch();
const ed = await editorPage(browser);

// ---- Alt+click the eye: only that layer stays on the canvas
{
  await ed.locator('button[aria-label="Add layer"]').first().click();
  await ed.waitForTimeout(300);
  const eyes = ed.locator('.layer-item .eye');
  const n = await eyes.count();
  if (n >= 2) {
    await eyes.nth(0).click({ modifiers: ['Alt'] });
    await ed.waitForTimeout(200);
    eq('the other layers are hidden', await ed.locator('.layer-item .eye.off').count(), n - 1);
    await eyes.nth(0).click({ modifiers: ['Alt'] });
    await ed.waitForTimeout(200);
    eq('Alt+click again brings them back', await ed.locator('.layer-item .eye.off').count(), 0);
  } else {
    check('could add a second layer to test isolate', false, `layers: ${n}`);
  }
}

// ---- Preview has the live values panel; it does not sit on Resources/Glossary
{
  await ed.getByRole('button', { name: /Preview/ }).first().click();
  await ed.waitForTimeout(500);
  const fromStart = ed.locator('.menu button, .menu-item').first();
  if (await fromStart.count()) { await fromStart.click(); }
  await ed.waitForSelector('.preview-overlay .player');
  await ed.waitForTimeout(600);
  const btn = ed.locator('.player-inspector-btn');
  eq('Preview shows the live values button', await btn.count(), 1);
  const overlaps = await ed.evaluate(() => {
    const a = document.querySelector('.player-inspector-btn').getBoundingClientRect();
    return [...document.querySelectorAll('.player-info-tabs, .player-hamburger, .player-topbar')].some((el) => {
      const b = el.getBoundingClientRect();
      return b.width && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    });
  });
  check('the button is clear of the menu, Resources and Glossary', !overlaps);
  await btn.click();
  await ed.waitForTimeout(250);
  check('the panel lists the course variables', (await ed.locator('.player-inspector-row').count()) > 0);
  eq('axe: live values panel', await axeViolations(ed, '.player-inspector'), []);
  if (process.env.SHOT) await ed.screenshot({ path: process.env.SHOT });
}

await browser.close();
finish();
