// Sends a published xAPI course's statements to a real LRS and reads them back.
// Needs an LRS: set XAPI_LRS_ENDPOINT (e.g. http://127.0.0.1:8080/xapi),
// XAPI_LRS_KEY and XAPI_LRS_SECRET. Without them the suite skips, so CI and
// plain `npm run test:e2e` stay offline. Verified against Yet Analytics lrsql:
//   docker run -d -p 127.0.0.1:8080:8080 -e LRSQL_API_KEY_DEFAULT=k -e LRSQL_API_SECRET_DEFAULT=s \
//     -e LRSQL_ADMIN_USER_DEFAULT=admin -e LRSQL_ADMIN_PASS_DEFAULT=adminpass1 yetanalytics/lrsql
import { randomUUID } from 'node:crypto';
import { check, eq, finish, launch, demoProject, goToSlideWith } from './harness.mjs';

const { XAPI_LRS_ENDPOINT: endpoint, XAPI_LRS_KEY: key, XAPI_LRS_SECRET: secret } = process.env;
if (!endpoint || !key || !secret) { console.log('skipped: set XAPI_LRS_ENDPOINT, XAPI_LRS_KEY and XAPI_LRS_SECRET to run against a real LRS'); process.exit(0); }

const auth = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
const headers = { 'X-Experience-API-Version': '1.0.3', Authorization: auth };
const registration = randomUUID();
const actor = { objectType: 'Agent', name: 'Test Learner', mbox: `mailto:learner-${registration.slice(0, 8)}@example.com` };

const project = await demoProject((p) => { p.completion = { mode: 'allSlides', autoScore: true, passingScore: 50 }; });
const browser = await launch({ args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights'] }); // the LRS is on loopback
const { readFileSync } = await import('node:fs');
const { join } = await import('node:path');
const player = readFileSync(join(new URL('../..', import.meta.url).pathname, 'dist/player.html'), 'utf8');
const html = player.replace('<head>', `<head>\n<script>window.FORGE_PUBLISH = { target: "xapi" };</script>\n<script id="forge-project" type="application/json">${JSON.stringify(project).replace(/</g, '\\u003c')}</script>\n`);
const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
const page = await ctx.newPage();
page.setDefaultTimeout(6000);
page.on('console', (m) => { if (process.env.DEBUG_XAPI) console.log('   [page]', m.text().slice(0, 200)); });
page.on('requestfailed', (r) => console.log('   request failed:', r.url().slice(0, 80), r.failure()?.errorText));
page.on('response', (r) => { if (process.env.DEBUG_XAPI && r.url().includes('/xapi/')) console.log('   ', r.status(), r.request().method(), r.url().slice(0, 90)); });
await page.route('**/course.html**', (r) => r.fulfill({ contentType: 'text/html', body: html }));
const q = new URLSearchParams({ endpoint, auth, actor: JSON.stringify(actor), registration });
await page.goto(`${new URL(process.env.E2E_BASE_URL).origin}/course.html?${q}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);

check('reached the quiz', (await goToSlideWith(page, '.mc-choice.live')) > 0);
await page.locator('.mc-choice.live').nth(1).click();
await page.locator('.mc-submit.live').first().click();
await page.waitForTimeout(400);
await page.locator('.mc-feedback button:has-text("Try again")').click();
await page.locator('.mc-choice.live').nth(0).click();
await page.locator('.mc-submit.live').first().click();
await page.waitForTimeout(500);
for (let i = 0; i < 10; i++) {
  const next = page.locator('button:has-text("Next")').first();
  if (await next.isDisabled().catch(() => true)) break;
  await next.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
}
await page.waitForTimeout(1500);
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await page.waitForTimeout(500);
await ctx.close();

const res = await fetch(`${endpoint}/statements?registration=${registration}&limit=100&ascending=true`, { headers });
check('LRS answers the query', res.ok, `HTTP ${res.status}`);
const { statements = [] } = await res.json();
const verbs = statements.map((s) => s.verb.id.split('/').pop());
console.log('   statements stored:', verbs.join(', '));
check('the LRS stored the statements', statements.length >= 4, `only ${statements.length}`);
check('every statement carries the learner and registration', statements.every((s) => s.actor.mbox === actor.mbox && s.context?.registration === registration));
const answers = statements.filter((s) => s.verb.id.endsWith('/answered'));
eq('one "answered" statement per attempt', answers.map((s) => s.result.success), [false, true]);
const def = answers[0]?.object?.definition ?? {};
eq('interaction type is choice with its correct response', [def.interactionType, def.correctResponsesPattern], ['choice', ['0']]);
check('the answered statements carry the learner\'s response', answers.every((s) => typeof s.result.response === 'string'));
const scored = statements.filter((s) => s.result?.score);
check('a scaled score was reported', scored.length > 0 && scored.at(-1).result.score.scaled === 0.5, JSON.stringify(scored.at(-1)?.result));
check('the course completed', verbs.includes('completed'));
// A separate passed/failed statement is only sent when finishing depends on the score.
check('the score statement says success against the pass mark', scored.at(-1)?.result?.success === true);

// Resume goes through the State API.
const st = await fetch(`${endpoint}/activities/state?` + new URLSearchParams({ activityId: statements[0]?.object?.id?.split('#')[0] ?? '', agent: JSON.stringify(actor), stateId: 'resume', registration }), { headers });
const stBody = await st.text();
console.log('   state:', st.status, stBody.slice(0, 120));
check('resume state is stored through the State API', st.status === 200 && stBody.length > 2, `HTTP ${st.status}`);

// A second, fresh browser (no localStorage) opens the same launch link and
// should land where the first one left off, using the LRS State API.
{
  const open = async () => {
    const c = await browser.newContext({ viewport: { width: 1300, height: 800 } });
    const pg = await c.newPage();
    pg.setDefaultTimeout(6000);
    await pg.route('**/course.html**', (r) => r.fulfill({ contentType: 'text/html', body: html }));
    const params = new URLSearchParams({ endpoint, auth, actor: JSON.stringify({ ...actor, mbox: 'mailto:resume-' + registration.slice(0, 8) + '@example.com' }), registration: randomUUID() });
    await pg.goto(`${new URL(process.env.E2E_BASE_URL).origin}/course.html?${params}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1200);
    return { c, pg, params };
  };
  const a = await open();
  const where = async (pg) => (await pg.locator('main.player-main').getAttribute('aria-label'));
  await goToSlideWith(a.pg, '.mc-choice.live');
  const left = await where(a.pg);
  await a.pg.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await a.pg.waitForTimeout(600);
  await a.c.close();
  const c2 = await browser.newContext({ viewport: { width: 1300, height: 800 } });
  const b = await c2.newPage();
  b.setDefaultTimeout(6000);
  await b.route('**/course.html**', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await b.goto(`${new URL(process.env.E2E_BASE_URL).origin}/course.html?${a.params}`, { waitUntil: 'domcontentloaded' });
  await b.waitForTimeout(2000);
  check('left off on a later slide', /slide [2-9]/.test(left), String(left));
  eq('a fresh browser resumes from the LRS State API', await where(b), left);
  await c2.close();
}
finish();
