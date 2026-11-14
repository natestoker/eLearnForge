// Runs the published SCORM output against scorm-again, an independent SCORM
// runtime that validates every SetValue against the SCORM data model the way an
// LMS does. A value the spec would reject comes back with a non-zero error code.
// Covers SCORM 1.2 and 2004: status, score, interactions (and a retry), resume.
import { readFileSync } from 'node:fs';
import { check, eq, finish, launch, demoProject, publishedPage, goToSlideWith } from './harness.mjs';

const lib = readFileSync(new URL('../../node_modules/scorm-again/dist/scorm-again.js', import.meta.url).pathname, 'utf8');

const browser = await launch();

for (const target of ['scorm12', 'scorm2004']) {
  const v12 = target === 'scorm12';
  const project = await demoProject((p) => { p.completion = { mode: 'allSlides', autoScore: true, passingScore: 50 }; });
  const setup = `
    window.__calls = [];
    const wrap = (api, names, errFn) => { for (const n of names) { const orig = api[n].bind(api); api[n] = (...a) => { const r = orig(...a); window.__calls.push({ n, a, r: String(r), err: String(api[errFn]()) }); return r; }; } };
    if (${v12}) { window.API = new window.Scorm12API({ logLevel: 5 }); wrap(window.API, ['LMSSetValue', 'LMSCommit', 'LMSFinish'], 'LMSGetLastError'); }
    else { window.API_1484_11 = new window.Scorm2004API({ logLevel: 5 }); wrap(window.API_1484_11, ['SetValue', 'Commit', 'Terminate'], 'GetLastError'); }
  `;
  const page = await publishedPage(browser, project, target, { content: lib + '\n' + setup });
  check(`${target}: reached the quiz`, (await goToSlideWith(page, '.mc-choice.live')) > 0);
  await page.locator('.mc-choice.live').nth(1).click();
  await page.locator('.mc-submit.live').first().click();
  await page.waitForTimeout(300);
  await page.locator('.mc-feedback button:has-text("Try again")').click();
  await page.locator('.mc-choice.live').nth(0).click();
  await page.locator('.mc-submit.live').first().click();
  await page.waitForTimeout(400);
  for (let i = 0; i < 10; i++) {
    const next = page.locator('button:has-text("Next")').first();
    if (await next.isDisabled().catch(() => true)) break;
    await next.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  }
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(300);
  const calls = await page.evaluate(() => window.__calls);
  const sets = calls.filter((c) => /SetValue/.test(c.n));
  const bad = calls.filter((c) => c.err !== '0');
  eq(`${target}: the runtime rejected nothing`, bad.map((c) => [c.n, ...c.a, c.err]), []);
  check(`${target}: values were written`, sets.length > 10, `only ${sets.length}`);
  const last = (key) => sets.filter((c) => c.a[0] === key).map((c) => c.a[1]).pop();
  const k = (a, b) => (v12 ? a : b);
  eq(`${target}: one interaction entry, reused on retry`, sets.some((c) => /interactions\.1\./.test(c.a[0])), false);
  eq(`${target}: retry turned the entry correct`, last(k('cmi.interactions.0.result', 'cmi.interactions.0.result')), 'correct');
  eq(`${target}: type is choice`, last('cmi.interactions.0.type'), 'choice');
  eq(`${target}: final score is 50 (1 of 2 questions)`, last(k('cmi.core.score.raw', 'cmi.score.raw')), '50');
  // allSlides completion: 2004 keeps completion and success apart. 1.2 has one
  // status field, so it says "completed" and leaves the score for the LMS.
  eq(`${target}: status`, last(k('cmi.core.lesson_status', 'cmi.success_status')), k('completed', 'passed'));
  check(`${target}: session time written on exit`, /^(PT|0000:)/.test(String(last(k('cmi.core.session_time', 'cmi.session_time')))) || /^\d{4}:/.test(String(last('cmi.core.session_time'))), String(last(k('cmi.core.session_time', 'cmi.session_time'))));
  check(`${target}: resume data saved`, String(last('cmi.suspend_data') ?? '').startsWith('{'), String(last('cmi.suspend_data')));
  if (!v12) eq(`${target}: course completed`, last('cmi.completion_status'), 'completed');
  await page.context().close();
}

await browser.close();
finish();
