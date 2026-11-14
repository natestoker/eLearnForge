// The Compress button in the Publish checks, end to end: a course with a very
// large image gets a warning, Compress shrinks it, and the warning goes away.
import { BASE, check, eq, finish, launch, demoProject, factory } from './harness.mjs';

const browser = await launch();
const f = await factory();
const project = await demoProject((p) => {
  const img = f.createBlock('image', 40, 40);
  img.props.src = '__BIG__';
  img.props.alt = 'A big noisy picture';
  p.slides[0].layers[0].blocks.push(img);
});

const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
page.on('pageerror', (e) => check('no page errors', false, e.message));

// Seed the editor's autosave with the project, using a ~20 MB noise PNG.
await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(async (projectJson) => {
  const c = document.createElement('canvas'); c.width = 2400; c.height = 2400;
  const x = c.getContext('2d'); const d = x.createImageData(2400, 2400);
  for (let i = 0; i < d.data.length; i += 4) { d.data[i] = Math.random() * 255; d.data[i + 1] = Math.random() * 255; d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  const big = c.toDataURL('image/png');
  const project = JSON.parse(projectJson.replace('__BIG__', 'placeholder'));
  JSON.stringify(project); // validate
  const text = JSON.stringify(project).replace('placeholder', big);
  const parsed = JSON.parse(text);
  await new Promise((resolve, reject) => {
    const open = indexedDB.open('elearnforge', 1);
    open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains('projects')) open.result.createObjectStore('projects'); };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(parsed, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}, JSON.stringify(project));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.locator('button:has-text("Publish")').first().click();
await page.waitForTimeout(800);
const warning = page.locator('.pd-check-row', { hasText: 'Large media file' });
eq('a very large image is flagged', await warning.count(), 1);
const before = await page.locator('.pd-size-total').innerText();
check('the size meter shows it', /MB/.test(before), before);
await warning.locator('button:has-text("Compress")').click();
await page.locator('.pd-check-row', { hasText: /^\s*Compressed image\/png/ }).waitFor({ timeout: 90000 });
await page.waitForTimeout(500);
eq('the warning is gone after compressing', await page.locator('.pd-check-row', { hasText: 'Large media file' }).count(), 0);
const after = await page.locator('.pd-size-total').innerText();
const mb = (s) => parseFloat(s);
check('the package is smaller', mb(after) < mb(before), `${before} -> ${after}`);
check('a result row says what was saved', /to \d/.test(await page.locator('.pd-check-row.pass', { hasText: 'Compressed' }).first().innerText()));

await browser.close();
finish();
