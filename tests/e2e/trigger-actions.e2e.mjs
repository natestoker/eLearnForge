// Key-press triggers, next slide, Execute JavaScript and Exit course in the real player.
import { check, eq, finish, launch, demoProject, playerPage } from './harness.mjs';

const browser = await launch();
const project = await demoProject((p) => {
  p.slides[0].triggers = [
    { id: 't1', event: 'onKeyPress', key: 'ArrowRight', conditions: [], actions: [{ type: 'nextSlide' }] },
    { id: 't2', event: 'onKeyPress', key: 'j', conditions: [], actions: [{ type: 'executeJs', code: 'forge.setVariable("flag", 1); document.title = "js:" + (41 + 1);' }] },
    { id: 't3', event: 'onKeyPress', key: 'q', conditions: [], actions: [{ type: 'exitCourse' }] }
  ];
  p.slides[1].triggers = [{ id: 't4', event: 'onKeyPress', key: 'ArrowLeft', conditions: [], actions: [{ type: 'prevSlide' }] }];
  p.variables.push({ id: 'v_flag', name: 'flag', type: 'number', defaultValue: 0 });
});
const page = await playerPage(browser, project);
const heading = () => page.locator('main.player-main').getAttribute('aria-label');

eq('starts on slide 1', await heading(), 'Welcome, slide 1 of 6');
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
eq('Right arrow goes to the next slide', await heading(), 'Spot the red flags, slide 2 of 6');
await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(500);
eq('Left arrow goes back', await heading(), 'Welcome, slide 1 of 6');
await page.keyboard.press('Control+j'); await page.waitForTimeout(200);
check('a modified key press is ignored', (await page.title()) !== 'js:42');
await page.keyboard.press('j'); await page.waitForTimeout(300);
eq('Execute JavaScript ran with the forge API', await page.title(), 'js:42');
await page.keyboard.press('q'); await page.waitForTimeout(500);
check('Exit course shows the end screen', (await page.locator('.player-exit').innerText()).includes('You have exited the course'));

await browser.close();
finish();
