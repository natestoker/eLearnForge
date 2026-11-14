// Shared helpers for the browser suites. Each suite is a plain Node script
// that imports this, runs real Chromium against the built app in dist/, prints
// ok / FAIL lines, and exits non-zero on failure. Run them with `npm run test:e2e`.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(new URL('../..', import.meta.url).pathname);
const require = createRequire(import.meta.url);

export const BASE = process.env.E2E_BASE_URL;
if (!BASE) { console.error('E2E_BASE_URL is not set. Run these through scripts/run-e2e.mjs (npm run test:e2e).'); process.exit(2); }

export const { chromium } = require('playwright');

let fails = 0;
export const check = (name, ok, detail = '') => {
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : detail);
};
export const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
export const finish = () => { console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0); };

// The real schema factory (demo course and block builders), bundled for Node.
let factoryPromise;
export function factory() {
  factoryPromise ??= (async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'ef-e2e-')), 'factory.cjs');
    await build({ entryPoints: [join(root, 'src/schema/factory.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error' });
    return require(out);
  })();
  return factoryPromise;
}

export async function demoProject(mutate) {
  const f = await factory();
  const p = f.createDemoProject();
  p.player = { ...f.defaultPlayerSettings(), ...(p.player ?? {}), menu: { show: true } };
  if (mutate) await mutate(p, f);
  return p;
}

export async function launch(opts = {}) {
  return chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', ...(opts.args ?? [])] });
}

// A player page with `project` handed over the way the editor's Preview does.
export async function playerPage(browser, project, { viewport = { width: 1300, height: 800 }, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript((pr) => { try { localStorage.setItem('elearnforge.preview', JSON.stringify(pr)); } catch { /* ignore */ } }, project);
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', (e) => check('no page errors', false, e.message));
  await page.goto(`${BASE}/player.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return page;
}

// A published-style course page (project embedded, tracking adapter chosen),
// served from memory so no extra files are needed.
export async function publishedPage(browser, project, target, initScript) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
  if (initScript) await ctx.addInitScript(initScript);
  const player = readFileSync(join(root, 'dist/player.html'), 'utf8');
  const inject = `<script>window.FORGE_PUBLISH = { target: ${JSON.stringify(target)} };</script>\n<script id="forge-project" type="application/json">${JSON.stringify(project).replace(/</g, '\\u003c')}</script>\n`;
  const html = player.replace('<head>', `<head>\n${inject}`);
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  await page.route('**/course.html', (route) => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(`${BASE}/course.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return page;
}

export async function editorPage(browser, viewport = { width: 1500, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', (e) => check('no page errors', false, e.message));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape'); // welcome dialog
  await page.waitForTimeout(300);
  return page;
}

// Press Next until `selector` appears (keyboard-style: focus then Enter).
export async function goToSlideWith(page, selector, max = 8) {
  for (let i = 0; i < max && !(await page.locator(selector).count()); i++) {
    await page.locator('button:has-text("Next")').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(450);
  }
  return page.locator(selector).count();
}

export const AXE_PATH = require.resolve('axe-core/axe.min.js');
export async function axeViolations(page, context = null) {
  // Let entrance animations and panel transitions finish: axe measures colors
  // as they are right now, and half-faded text reads as low contrast.
  await page.waitForTimeout(1800);
  await page.addScriptTag({ path: AXE_PATH });
  const r = await page.evaluate(async (ctx) => window.axe.run(ctx ? document.querySelector(ctx) : document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }
  }), context);
  return r.violations.map((v) => `${v.impact}: ${v.id} (${v.nodes.length}) ${v.nodes[0].target.join(' ').slice(0, 80)}`);
}
