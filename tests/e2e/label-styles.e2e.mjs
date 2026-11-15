// Font, size, weight, italic and color for the label of a slider, and the other
// widgets that carry one (checklist title, results heading, tab buttons...).
import { check, eq, finish, launch, editorPage } from './harness.mjs';

const browser = await launch();
const page = await editorPage(browser);

async function insert(label) {
  await page.locator('.ribbon-tab', { hasText: 'Insert' }).click();
  await page.locator('.rbn-mbtn', { hasText: label }).first().click();
  await page.waitForTimeout(400);
}
const section = (title) => page.locator('.panel-scroll').locator(`xpath=.//h4[contains(., "${title}")]/following-sibling::*[position()<=6]`);
async function setField(labelText, fn) {
  const f = page.locator('.panel-scroll .field', { has: page.locator(`.field-label:text-is("${labelText}")`) }).last();
  await fn(f);
  await page.waitForTimeout(250);
}

// ---- slider
await insert('Slider');
check('the slider has a text-style section', (await page.locator('.panel-subtitle', { hasText: 'Label text' }).count()) === 1);
await setField('Font', (f) => f.locator('select').selectOption('Georgia'));
await setField('Weight', (f) => f.locator('select').selectOption('700'));
await setField('Size (px)', (f) => f.locator('input').fill('26'));
await page.locator('.panel-scroll label.checkbox', { hasText: 'Italic' }).locator('input').check();
await setField('Color', async (f) => { const i = f.locator('.color-input input.input'); await i.fill('#cc3300'); await i.press('Enter'); });
await page.waitForTimeout(300);
const css = await page.locator('.stage-block.selected .slider-label').evaluate((el) => { const c = getComputedStyle(el); return { family: c.fontFamily, weight: c.fontWeight, size: c.fontSize, style: c.fontStyle, color: c.color }; });
check('font family applied', /Georgia/.test(css.family), css.family);
eq('weight, size, italic and color applied', [css.weight, css.size, css.style, css.color], ['700', '26px', 'italic', 'rgb(204, 51, 0)']);
await page.locator('.panel-scroll button', { hasText: 'Reset text style' }).click();
await page.waitForTimeout(250);
const after = await page.locator('.stage-block.selected .slider-label').evaluate((el) => getComputedStyle(el).fontSize);
eq('Reset text style returns to the default', after, '15px');

// ---- the others take the same fields
for (const [name, key] of [['Checklist', 'Title text'], ['Results', 'Heading text'], ['Tabs', 'Tab text'], ['Score', 'Caption text']]) {
  await insert(name);
  const n = await page.locator('.panel-subtitle', { hasText: key }).count();
  check(`${name} has text style fields (${key})`, n === 1, `found ${n}`);
}
await browser.close();
finish();
