// Story view: slides on a grid that wraps to the dialog, never sideways.
import { check, eq, finish, launch, editorPage, axeViolations } from './harness.mjs';

const browser = await launch();
const page = await editorPage(browser);

const open = async () => {
  await page.locator('.ribbon-tab', { hasText: 'View' }).click();
  await page.locator('button', { hasText: 'Story View' }).first().click();
  await page.waitForSelector('.storyview');
  await page.waitForTimeout(300);
};
const layout = () => page.evaluate(() => {
  const sc = document.querySelector('.storyview-scroll');
  const nodes = [...document.querySelectorAll('.storyview-node')].map((n) => n.getBoundingClientRect());
  return {
    count: nodes.length,
    rows: new Set(nodes.map((r) => Math.round(r.top))).size,
    sideways: sc.scrollWidth > sc.clientWidth + 1,
    inside: nodes.every((r) => r.left >= sc.getBoundingClientRect().left && r.right <= sc.getBoundingClientRect().right)
  };
});

await open();
const wide = await layout();
check('every slide has a card', wide.count >= 3);
check('cards stay inside the dialog with no sideways scroll', wide.inside && !wide.sideways);
check('thumbnails are real slide renders', (await page.locator('.storyview-node .slide-preview-stage').count()) > 0);
eq('axe: Story view', await axeViolations(page, '.storyview'), []);

// A narrow window wraps the same slides onto more rows.
await page.setViewportSize({ width: 620, height: 800 });
await page.waitForTimeout(300);
const narrow = await layout();
eq('same slides after resizing', narrow.count, wide.count);
check('a narrow window wraps onto more rows', narrow.rows > wide.rows);
check('still no sideways scroll when narrow', narrow.inside && !narrow.sideways);

// Clicking a card jumps to that slide and closes the view.
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(200);
const name = (await page.locator('.storyview-node').nth(2).locator('.sv-name').innerText()).trim();
await page.locator('.storyview-node').nth(2).click();
await page.waitForTimeout(250);
eq('the view closes', await page.locator('.storyview').count(), 0);
check('the clicked slide is selected', (await page.locator('.slide-item.active').innerText()).includes(name));

await browser.close();
finish();
