// The Course settings dialog: one place for theme, player, resources,
// glossary and question banks.
import { check, eq, finish, launch, editorPage, axeViolations } from './harness.mjs';

const browser = await launch();
const page = await editorPage(browser);
const nav = (label) => page.locator('.cs-nav-item', { hasText: label });

await page.getByRole('button', { name: 'Course', exact: true }).click();
await page.waitForSelector('.cs-root');
eq('opens on Theme', await page.locator('.cs-nav-item.active').innerText().then((t) => t.trim()), 'Theme');
eq('axe: Theme section', await axeViolations(page, '.cs-root'), []);

// ---- Player: a label change shows in the live preview, and every control is labelled
await nav('Player').click();
await page.waitForTimeout(200);
const nextLabel = page.locator('.cs-navrow').nth(1).locator('input.input');
await nextLabel.fill('Continue');
await nextLabel.press('Tab');
await page.waitForTimeout(250);
check('the preview shows the new Next label', (await page.locator('.cs-pv-nav').innerText()).includes('Continue'));
await page.locator('.cs-toggle', { hasText: 'Course progress bar' }).locator('input').check();
await page.waitForTimeout(200);
eq('turning on the progress bar shows it in the preview', await page.locator('.cs-pv-progress').count(), 1);
eq('axe: Player section', await axeViolations(page, '.cs-root'), []);

// ---- Glossary: empty state, paste a list, count badge
await nav('Glossary').click();
await page.waitForTimeout(200);
check('the empty state explains the glossary and shows an example', (await page.locator('.cs-empty').innerText()).includes('No terms yet') && (await page.locator('.cs-empty-example').count()) === 1);
eq('axe: Glossary empty state', await axeViolations(page, '.cs-root'), []);
await page.locator('.cs-body button', { hasText: 'Paste a list' }).click();
await page.locator('.cs-paste textarea').fill('Phishing: A fake message.\nSpoofing - Faking the sender.\nVishing');
await page.locator('.cs-paste button', { hasText: /Add 3 terms/ }).click();
await page.waitForTimeout(300);
eq('three terms were added', await page.locator('.cs-item').count(), 3);
eq('term and definition were split', [await page.locator('.cs-item').nth(1).locator('input.input').inputValue(), await page.locator('.cs-item').nth(1).locator('textarea').inputValue()], ['Spoofing', 'Faking the sender.']);
eq('the count badge follows', (await nav('Glossary').locator('.cs-count').innerText()).trim(), '3');
eq('axe: Glossary list', await axeViolations(page, '.cs-root'), []);

// ---- Resources and banks
await nav('Resources').click();
await page.locator('.cs-body button', { hasText: 'Add a link' }).click();
await page.waitForTimeout(200);
eq('a link resource is listed', await page.locator('.cs-item').count(), 1);
await nav('Question banks').click();
await page.waitForTimeout(200);
check('banks offers to start from the course\'s quiz slides', /Start from this course's \d+ quiz slide/.test(await page.locator('.cs-empty').innerText()));
await page.locator('.cs-body button', { hasText: /Start from this course/ }).click();
await page.waitForTimeout(300);
check('a bank was created with slides ticked', (await page.locator('.cs-banks .bank-card').count()) === 1 && (await page.locator('.cs-banks input[type=checkbox]:checked').count()) >= 1);

// ---- The Home ribbon buttons open the same dialog at their section; Escape closes it
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
eq('Escape closes the dialog', await page.locator('.cs-root').count(), 0);
await page.locator('.ribbon-tab', { hasText: 'Home' }).click();
await page.locator('.rbn-course-btn', { hasText: 'Glossary' }).click();
await page.waitForTimeout(200);
eq('Home > Glossary opens the Glossary section', (await page.locator('.cs-nav-item.active').innerText()).includes('Glossary'), true);
await page.locator('.cs-done').click();
eq('Done closes it', await page.locator('.cs-root').count(), 0);

await browser.close();
finish();
