// Editor: the Triggers panel flags a deleted target, the Publish dialog locks and links back to it.
import { check, eq, finish, launch, editorPage } from './harness.mjs';

const browser = await launch();
const page = await editorPage(browser);

// A clean course can publish.
await page.locator('button:has-text("Publish")').first().click();
await page.waitForTimeout(400);
eq('Publish is available on a clean course', await page.locator('.pd-publish.locked').count(), 0);
check('completion rules, pass mark and max attempts are there', (await page.locator('.pd-radio').count()) === 4 && (await page.locator('#pd-pass').count()) === 1 && (await page.locator('.pd-stepper').count()) === 1);
await page.locator('.pd-stepper button[aria-label="More attempts"]').click();
eq('Max attempts steps up', (await page.locator('.pd-stepper-val').innerText()).trim(), '1');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// Point a trigger at a layer, then delete the layer.
await page.locator('button[title="Add layer"]').click();
await page.locator('.ribbon-tabs button').filter({ hasText: /^Triggers$/ }).click();
await page.locator('.tp-add').click();
await page.locator('.tp-opt').filter({ hasText: /^Show layer$/ }).first().click();
await page.locator('.tp-tray .tp-opt').last().click();
await page.locator('button[title="Delete layer"]').last().click();
await page.waitForTimeout(400);
eq('the Triggers panel counts the issue', (await page.locator('.tp-badge-err').innerText()).trim(), '1 issue');

await page.locator('button:has-text("Publish")').first().click();
await page.waitForTimeout(400);
eq('Publish is locked while an error remains', await page.locator('.pd-publish.locked').count(), 1);
check('the status says what to do', (await page.locator('.pd-status').innerText()).includes('Resolve 1 error'));
await page.locator('.pd-fix').first().click();
await page.waitForTimeout(400);
eq('Open trigger closes the dialog and shows the trigger', [await page.locator('.pd-root').count(), await page.locator('.tp-card.open').count()], [0, 1]);

await browser.close();
finish();
