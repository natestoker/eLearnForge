// Screenshots every screen and state of the editor and the player into
// docs/design/screens/, for design review. Serves dist/ itself.
//   npm run build && node scripts/capture-screens.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { build } from 'esbuild';
import { tmpdir } from 'node:os';

const root = resolve(new URL('..', import.meta.url).pathname);
const dist = join(root, 'dist');
const out = join(root, 'docs/design/screens');
mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const p = (req.url ?? '/').split('?')[0];
  try { res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'text/html' }).end(await readFile(join(dist, p === '/' ? 'index.html' : p))); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// The real demo course, for the player.
const tmp = join(tmpdir(), 'cap-' + Date.now()); mkdirSync(tmp);
await build({ entryPoints: [join(root, 'src/schema/factory.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: join(tmp, 'f.cjs'), logLevel: 'error' });
const f = require(join(tmp, 'f.cjs'));
const demo = f.createDemoProject();
demo.resources = [{ id: 'r1', title: 'Phishing checklist (PDF)', url: 'https://example.com/checklist.pdf', description: 'Open in a new tab' }, { id: 'r2', title: 'Report a suspicious email', url: 'https://example.com/report', description: 'Open in a new tab' }];
demo.glossary = [{ id: 'g1', term: 'Phishing', definition: 'A fake message that tries to trick you into giving something away.' }, { id: 'g2', term: 'Spoofing', definition: 'Faking the sender of a message so it looks trustworthy.' }];
demo.player = { ...f.defaultPlayerSettings(), ...(demo.player ?? {}), menu: { show: true } };

const browser = await chromium.launch();
const shots = [];
const shot = async (page, name, note, opts = {}) => {
  try {
    await page.waitForTimeout(opts.wait ?? 350);
    await page.screenshot({ path: join(out, `${name}.png`), ...(opts.clip ? { clip: opts.clip } : {}) });
    shots.push({ name, note });
    console.log('ok  ', name);
  } catch (e) { console.log('FAIL', name, String(e).split('\n')[0]); }
};
const tryDo = async (label, fn) => { try { await fn(); } catch (e) { console.log('skip', label, String(e).split('\n')[0]); } };

// ------------------------------------------------------------------ editor
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  await page.goto(`${BASE}/index.html`); await page.waitForTimeout(1500);
  await shot(page, 'ed-00-welcome', 'First-run welcome dialog');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  for (const t of ['Insert', 'View']) {
    await tryDo(t, async () => { await page.locator('.ribbon-tab', { hasText: t }).click(); await shot(page, `ed-01-ribbon-${t.toLowerCase()}`, `${t} ribbon tab, nothing selected`); });
  }
  // select the title (text) block
  await shot(page, 'ed-01-inspector-slide', 'Nothing selected: the inspector shows the slide settings');
  await tryDo('select', async () => { await page.locator('.stage-block').first().click({ force: true }); });
  for (const t of ['Arrange', 'Animate']) {
    await tryDo(t, async () => { await page.locator('.ribbon-tab', { hasText: t }).click(); await shot(page, `ed-02-ribbon-${t.toLowerCase()}`, `${t} ribbon tab, a text block selected`); });
  }
  for (const t of ['Properties', 'Effects', 'Animate']) {
    await tryDo(t, async () => { await page.locator('.tab', { hasText: t }).first().click(); await shot(page, `ed-03-panel-${t.toLowerCase()}`, `Right panel, ${t} tab, text block`); });
  }
  await tryDo('triggers', async () => { await page.locator('.rtab', { hasText: 'Triggers' }).click(); await shot(page, 'ed-04-triggers', 'Triggers tab with the trigger list'); });
  await tryDo('trigger open', async () => { await page.locator('.tp-row, .tp-card, [class*="tp-trigger"]').first().click(); await shot(page, 'ed-04b-trigger-open', 'A trigger expanded'); });
  await tryDo('variables', async () => { await page.locator('.rtab', { hasText: 'Variables' }).click(); await shot(page, 'ed-05-variables', 'Variables tab'); await page.locator('.rtab', { hasText: 'Inspect' }).click(); });
  await page.locator('.ribbon-tab', { hasText: 'Insert' }).click();
  await tryDo('all shapes', async () => { await page.locator('.rbn-mbtn', { hasText: 'All shapes' }).click(); await shot(page, 'ed-06-all-shapes', 'All shapes menu'); await page.keyboard.press('Escape'); await page.mouse.click(700, 400); });
  await tryDo('pen', async () => { await page.locator('.rbn-mbtn', { hasText: 'Custom' }).click(); await shot(page, 'ed-07-pen-tool', 'Pen tool dialog'); await page.keyboard.press('Escape'); });
  await tryDo('file menu', async () => { await page.getByRole('button', { name: /File/ }).first().click(); await shot(page, 'ed-08-file-menu', 'File menu'); await page.keyboard.press('Escape'); await page.mouse.click(700, 500); });
  await tryDo('quiz', async () => { await page.locator('.slide-item').nth(2).click(); await shot(page, 'ed-09-quiz-slide', 'A quiz slide in the editor'); await page.locator('.stage-block').nth(1).click({ force: true }); await shot(page, 'ed-09b-quiz-props', 'Quiz block properties'); });
  await tryDo('slide ctx', async () => { await page.locator('.stage').click({ button: 'right', position: { x: 50, y: 50 } }); await shot(page, 'ed-10-context-menu', 'Canvas right-click menu'); await page.keyboard.press('Escape'); });
  await tryDo('story view', async () => { await page.locator('.ribbon-tab', { hasText: 'View' }).click(); await page.locator('button', { hasText: 'Story View' }).first().click(); await shot(page, 'ed-11-story-view', 'Story View'); await page.keyboard.press('Escape'); });
  for (const [name, label] of [['theme', 'Theme'], ['player', 'Player'], ['resources', 'Resources'], ['glossary', 'Glossary'], ['banks', 'Question banks']]) {
    await tryDo(name, async () => {
      if (!(await page.locator('.cs-root').count())) await page.getByRole('button', { name: 'Course', exact: true }).click();
      await page.locator('.cs-nav-item', { hasText: label }).click();
      await shot(page, `ed-12-course-${name}`, `Course settings, ${label} section`);
    });
  }
  await tryDo('glossary filled', async () => { await page.locator('.cs-nav-item', { hasText: 'Glossary' }).click(); await page.locator('.cs-body button', { hasText: 'Add term' }).click(); await shot(page, 'ed-12-course-glossary-filled', 'Course settings, Glossary with a term'); await page.keyboard.press('Control+z'); });
  await tryDo('close cs', async () => { await page.locator('.cs-done').click(); });
  await tryDo('publish', async () => { await page.getByRole('button', { name: 'Publish' }).click(); await shot(page, 'ed-13-publish', 'Publish dialog'); await page.keyboard.press('Escape'); });
  await tryDo('timeline', async () => { await shot(page, 'ed-14-timeline', 'Timeline strip', { clip: { x: 240, y: 690, width: 940, height: 190 } }); });
  await tryDo('layers', async () => { await shot(page, 'ed-15-left-panels', 'Slides and Layers panels', { clip: { x: 0, y: 200, width: 240, height: 680 } }); });
  await ctx.close();
}

// ------------------------------------------------------------------ player
async function playerShots(prefix, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript((pr) => { try { localStorage.setItem('elearnforge.preview', JSON.stringify(pr)); } catch {} }, demo);
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  await page.goto(`${BASE}/player.html`); await page.waitForTimeout(1500);
  await shot(page, `${prefix}-01-start`, 'Player, first slide');
  const next = async () => { await page.locator('button:has-text("Next")').first().focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500); };
  await tryDo('menu', async () => { await page.locator('[aria-label*="navigation" i], .player-hamburger').first().click(); await shot(page, `${prefix}-02-menu`, 'Course menu open'); await page.locator('[aria-label*="navigation" i], .player-hamburger').first().click(); });
  await next(); await shot(page, `${prefix}-03-slide2`, 'Second slide');
  for (let i = 0; i < 6 && !(await page.locator('.mc-choice.live').count()); i++) await next();
  await shot(page, `${prefix}-04-quiz`, 'Quiz slide');
  await tryDo('answer', async () => { await page.locator('.mc-choice.live').nth(1).click(); await page.locator('.mc-submit.live').first().click(); await shot(page, `${prefix}-05-quiz-feedback`, 'Quiz feedback after a wrong answer'); });
  await tryDo('res', async () => { await page.locator('button', { hasText: /Resources/ }).first().click(); await shot(page, `${prefix}-06-resources`, 'Resources panel'); await page.keyboard.press('Escape'); });
  await tryDo('gloss', async () => { await page.locator('button', { hasText: /Glossary/ }).first().click(); await shot(page, `${prefix}-07-glossary`, 'Glossary panel'); await page.keyboard.press('Escape'); });
  for (let i = 0; i < 6 && !(await page.locator('.dd-block').count()); i++) await next();
  await tryDo('dd', async () => { await shot(page, `${prefix}-08-dragdrop`, 'Drag and drop slide'); });
  for (let i = 0; i < 8; i++) { const n = page.locator('button:has-text("Next")').first(); if (await n.isDisabled().catch(() => true)) break; await next(); }
  await shot(page, `${prefix}-09-last`, 'Last slide');
  await ctx.close();
}
await playerShots('pl-desktop', { width: 1280, height: 720 }, false);
await playerShots('pl-phone', { width: 390, height: 844 }, true);

await browser.close(); server.close();
import('node:fs').then(({ writeFileSync }) => writeFileSync(join(out, '_index.json'), JSON.stringify(shots, null, 2)));
console.log(`${shots.length} screenshots in docs/design/screens`);
