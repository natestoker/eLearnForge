import { fileURLToPath } from 'node:url'; const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
import { createRequire } from 'node:module';
const { chromium } = createRequire(ROOT + '/package.json')('playwright');
const B = 'http://127.0.0.1:8081';
const cmid = process.argv[2];
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
const page = await ctx.newPage(); page.setDefaultTimeout(30000);
await page.goto(B + '/login/index.php');
await page.fill('#username', 'admin'); await page.fill('#password', 'Elfpass-9876xyz'); await Promise.all([page.waitForURL(/\/my\//), page.locator('#password').press('Enter')]);
await page.goto(`${B}/mod/scorm/view.php?id=${cmid}`);
const popupP = ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null);
await page.locator('input[type=submit][value="Enter"], button:has-text("Enter")').first().click();
let pop = await popupP; if (!pop) pop = page;
await pop.waitForLoadState('domcontentloaded'); await pop.waitForTimeout(3000);
console.log('player url', pop.url());
// the course is in an iframe
const frame = pop.frames().find((f) => f.url().includes('index.html') || f.url().includes('/pluginfile.php')) ?? pop.mainFrame();
console.log('frame', frame.url().slice(0, 100));
const fl = (s) => frame.locator(s);
for (let i = 0; i < 8 && !(await fl('.mc-choice.live').count()); i++) { await fl('button:has-text("Next")').first().click({ force: true }); await pop.waitForTimeout(500); }
await fl('.mc-choice.live').nth(1).click(); await fl('.mc-submit.live').first().click(); await pop.waitForTimeout(500);
await fl('.mc-feedback button:has-text("Try again")').click(); await fl('.mc-choice.live').nth(0).click(); await fl('.mc-submit.live').first().click(); await pop.waitForTimeout(800);
for (let i = 0; i < 10; i++) { const n = fl('button:has-text("Next")').first(); if (await n.isDisabled().catch(() => true)) break; await n.click({ force: true }); await pop.waitForTimeout(400); }
await pop.waitForTimeout(1500);
const where = async (f) => f.locator('main.player-main').getAttribute('aria-label');
const before = await where(frame);
await pop.screenshot({ path: process.argv[3] });
if (pop !== page) await pop.close(); else await page.goto(B + '/my/');
await page.waitForTimeout(1500);
// re-enter: a new attempt may start, so check resume through the LMS's suspend_data on the same attempt
await page.goto(`${B}/mod/scorm/view.php?id=${cmid}`);
console.log('left on', before);
await pop.screenshot({ path: process.argv[3] ?? '/tmp/m4.png' });
await b.close();
