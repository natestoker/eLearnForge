// Quiz scoring, retries and attempt limits, reported to a fake SCORM 1.2 LMS.
import { check, eq, finish, launch, demoProject, publishedPage, playerPage, goToSlideWith } from './harness.mjs';

const browser = await launch();

// ---- one interaction entry per question, updated on retry; score from answers
{
  const project = await demoProject((p) => { p.completion = { mode: 'allSlides', autoScore: true, passingScore: 50 }; });
  const page = await publishedPage(browser, project, 'scorm12', () => {
    const store = {};
    window.__log = [];
    window.API = {
      LMSInitialize: () => 'true', LMSFinish: () => 'true', LMSCommit: () => 'true', LMSGetLastError: () => '0',
      LMSGetValue: (k) => (k === 'cmi.interactions._count' ? '0' : store[k] || ''),
      LMSSetValue: (k, v) => { store[k] = v; window.__log.push([k, v]); return 'true'; }
    };
    window.__store = store;
  });
  check('reached the quiz slide', (await goToSlideWith(page, '.mc-choice.live')) > 0);
  await page.locator('.mc-choice.live').nth(1).click();           // a wrong answer
  await page.locator('.mc-submit.live').first().click();
  await page.waitForTimeout(300);
  let s = await page.evaluate(() => ({ ...window.__store }));
  eq('first answer is recorded as wrong', s['cmi.interactions.0.result'], 'wrong');
  await page.locator('.mc-feedback button:has-text("Try again")').click();
  await page.locator('.mc-choice.live').nth(0).click();           // the right answer
  await page.locator('.mc-submit.live').first().click();
  await page.waitForTimeout(300);
  s = await page.evaluate(() => ({ ...window.__store }));
  eq('the retry updates the same entry', [s['cmi.interactions.0.result'], s['cmi.interactions.1.id']], ['correct', undefined]);
  eq('type is choice and the correct pattern was written once', [s['cmi.interactions.0.type'], s['cmi.interactions.0.correct_responses.0.pattern']], ['choice', '0']);
  check('latency and time are in LMS formats', /^\d{4}:\d\d:\d\d\.\d\d$/.test(s['cmi.interactions.0.latency']) && /^\d\d:\d\d:\d\d$/.test(s['cmi.interactions.0.time']));
  eq('score is the share of scored questions right (1 of 2)', s['cmi.core.score.raw'], '50');
  await page.context().close();
}

// ---- Max attempts locks the question after the last answer
{
  const project = await demoProject((p) => { p.completion = { mode: 'allSlides', maxAttempts: 1 }; });
  const page = await playerPage(browser, project);
  await goToSlideWith(page, '.mc-choice.live');
  await page.locator('.mc-choice.live').nth(1).click();
  await page.locator('.mc-submit.live').first().click();
  await page.waitForTimeout(300);
  eq('no Try again button after the only attempt', await page.locator('.mc-feedback button:has-text("Try again")').count(), 0);
  eq('the learner is told why', (await page.locator('.attempts-note').innerText()).trim(), 'No attempts left.');
  await page.context().close();
}

await browser.close();
finish();
