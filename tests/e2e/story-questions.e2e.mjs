// Open Storyline (.story): the built-in question types and a result slide.
// A small package in the shape Storyline writes: form questions carry their
// answers as data, so they should arrive as eLearnForge quiz blocks that play.
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, eq, finish, launch, editorPage, playerPage } from './harness.mjs';

const JSZip = createRequire(import.meta.url)('jszip');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const doc = (text) => esc(`<Document><Content><Block><Style Justification="Left" LineSpacingRule="Single" /><Span Text="${text}"><Style FontFamily="Arial" FontSize="14" ForegroundColor="#112233" /></Span></Block></Content></Document>`);
const tm = '<tmCtxLst version="2"><tmCtx start="0" dur="5000" untilEnd="true" /></tmCtxLst>';
const Z = '00000000-0000-0000-0000-000000000000';
const box = (tag, g, name, [l, t, r, b], inner = '', attrs = '') => `<${tag} g="${g}" name="${name}" rot="-1" ${attrs}>${tm}<trigLst /><stateLst /><bG><noFill /></bG><loc l="${l}" t="${t}" r="${r}" b="${b}" /><animEffect />${inner}</${tag}>`;
const textBox = (g, name, loc, text) => box('textBox', g, name, loc, `<text>${doc(text)}</text><plain>${text}</plain>`);
const fbLayer = (g, text) => `<feedBackLayer g="${g}" name="" modal="false"><tmProps min="5000" /><bg /><shapeLst>${box('feedbackTextBox', `${g}-h`, 'Title', [300, 300, 700, 340], '<plain>Heading</plain>')}${box('feedbackTextBox', `${g}-t`, 'Feedback Text', [300, 360, 700, 420], `<plain>${text}</plain>`)}</shapeLst><trigLst /></feedBackLayer>`;
const intrProps = (title, cor, inc) => `<intrProps corPts="10" attempts="one" titleBoxG="${title}" corFbG="${cor}" incFbG="${inc}" tryFbG="${Z}" />`;
const sld = (g, name, shapes, layers = '', trigs = '') => `<?xml version="1.0" encoding="utf-8"?><sld g="${g}" name="${name}" layoutG="lay-1" layoutType="Quiz Questions"><tmProps min="5000" /><bg /><shapeLst>${shapes}</shapeLst><trigLst>${trigs}</trigLst><sldLayerLst>${layers}</sldLayerLst></sld>`;
const trig = ({ event, action, inner = '', cond = '' }) => `<trig g="t-${Math.random()}"><data enabled="true" event="${event}" action="${action}" actSubType="spec"><keyPress keys="None" />${inner}<other /></data><condLst>${cond}</condLst></trig>`;

// 1. Multiple choice: radios under the question, the label on the Normal state.
const radio = (g, text, top, correct) => `<radio g="${g}" name="Radio Button" parentG="q-mc" rot="-1">${tm}<trigLst /><stateLst><radioShapeState g="${g}-n" name="Normal"><shapeLst><radio g="${g}-in"><loc l="0" t="0" r="800" b="40" /><plain>${text}</plain></radio></shapeLst></radioShapeState></stateLst><bG /><loc l="80" t="${top}" r="880" b="${top + 40}" /><animEffect /><scoreData correct="${correct}" pts="0" /></radio>`;
const mc = sld('sld-mc', 'Multiple choice',
  box('multiChoiceIntr', 'q-mc', 'Question Choice', [80, 120, 880, 500], intrProps('mc-title', 'mc-cor', 'mc-inc')) +
  radio('r3', 'Saturn', 240, false) + radio('r1', 'Mars', 140, true) + radio('r2', 'Venus', 190, false) +
  textBox('mc-title', 'Question', [80, 40, 880, 100], 'Which planet is red?'),
  fbLayer('mc-cor', 'Mars it is.') + fbLayer('mc-inc', 'Look again.'));

// 2. Matching by drag and drop: each row pairs a drop area with a drag item.
const row = (i, left, right, top) =>
  `<matchDropArea g="drop-${i}" name="Choice" parentG="row-${i}" rot="-1">${tm}<stateLst /><bG /><loc l="80" t="${top}" r="460" b="${top + 40}" /><plain>${left}</plain></matchDropArea>` +
  `<matchDragDropItem g="row-${i}" name="Row" parentG="q-match" rot="-1">${tm}<childLst><g>drop-${i}</g><g>drag-${i}</g></childLst><stateLst /><bG /><loc l="80" t="${top}" r="880" b="${top + 40}" /><scoreData correct="false" /></matchDragDropItem>`;
const dragItem = (i, text, top) => `<matchDragItem g="drag-${i}" name="Match" parentG="row-${i}" rot="-1">${tm}<stateLst /><bG /><loc l="480" t="${top}" r="880" b="${top + 40}" /><plain>${text}</plain></matchDragItem>`;
const match = sld('sld-match', 'Matching',
  box('matchDragDropIntr', 'q-match', 'Question Choice', [80, 120, 880, 500], intrProps('m-title', 'm-cor', 'm-inc')) +
  row(1, 'Mercury', 'Closest to the Sun', 140) + row(2, 'Jupiter', 'Largest planet', 190) +
  dragItem(1, 'Closest to the Sun', 190) + dragItem(2, 'Largest planet', 140) +
  textBox('m-title', 'Question', [80, 40, 880, 100], 'Match each planet.'),
  fbLayer('m-cor', 'All matched.') + fbLayer('m-inc', 'Not matched.'));

// 3. A freeform fill-in: accepted answers are bare words on the question.
const fill = sld('sld-fill', 'Fill in',
  textBox('f-title', 'Prompt', [80, 40, 880, 100], 'Rust is iron ___.') +
  box('textEntry', 'f-entry', 'Answer field', [80, 200, 600, 260], '', 'multi="false"') +
  box('freeTextEntryIntr', 'q-fill', '', [0, 0, 10, 10], `${intrProps(Z, 'f-cor', 'f-inc')}<choices><intrFreeChoice compType="none"><scoringData correct="false" /><text>oxide</text></intrFreeChoice><intrFreeChoice compType="none"><scoringData correct="false" /><text>Oxide</text></intrFreeChoice></choices>`, `textEntryG="f-entry" case="false"`) +
  box('roundRect', 'f-submit', 'Submit', [700, 420, 880, 480], `<trigLst>${trig({ event: 'OnClick', action: 'submitInteraction', inner: '<interaction submitG="q-fill" />' })}</trigLst>`).replace('<trigLst />', ''),
  fbLayer('f-cor', 'Yes.') + fbLayer('f-inc', 'No.'));

// 4. Result slide: text reads the quiz variables, layers follow the score.
const layer = (g, name, text) => `<sldLayer g="${g}" name="${name}"><tmProps min="5000" /><bg /><shapeLst>${textBox(`${g}-t`, 'Message', [200, 300, 760, 360], text)}</shapeLst><trigLst /></sldLayer>`;
const result = sld('sld-res', 'Results',
  box('rsltsIntr', 'q-res', '', [30, 30, 930, 510], `<intrProps titleBoxG="${Z}" corFbG="${Z}" incFbG="${Z}" tryFbG="${Z}" />`, `quizG="quiz-1"`) +
  textBox('res-score', 'Score', [80, 100, 880, 160], 'YOUR SCORE: %Quiz1.ScorePercent%%') +
  textBox('res-pass', 'Pass', [80, 180, 880, 240], 'PASS MARK: %Quiz1.PassPercent%%'),
  layer('lay-pass', 'Success', 'You passed.') + layer('lay-fail', 'Failure', 'Not yet.'),
  trig({ event: 'OnStart', action: 'showSubSlide', inner: '<sldLayer showG="lay-pass" />', cond: '<trigCond op="gte" varG="v-score" varG2="v-pass" dataType="var" andOr="and" />' }) +
  trig({ event: 'OnStart', action: 'showSubSlide', inner: '<sldLayer showG="lay-fail" />', cond: '<trigCond op="lt" varG="v-score" varG2="v-pass" dataType="var" andOr="and" />' }));

const story = `<?xml version="1.0" encoding="utf-8"?><story>
<varLst>
  <var g="v-score" name="Quiz1.ScorePoints" dataType="num" val="0" type="prop" />
  <var g="v-pass" name="Quiz1.PassPoints" dataType="num" val="0" type="prop" />
</varLst>
<mediaLst><mediaLst /></mediaLst>
<quizMgr><quizLst><quiz g="quiz-1" name="Quiz1" passScore="60" scorePoints="v-score" passPoints="v-pass" scorePct="v-scorepct" passPct="v-passpct" /></quizLst></quizMgr>
<sceneLst><scene g="sc1" name="Main" sceneType="scene"><sldIdLst><sldId>RA</sldId><sldId>RB</sldId><sldId>RC</sldId><sldId>RD</sldId></sldIdLst></scene></sceneLst>
<propLst><prop id="1"><sz w="960" h="540" /></prop></propLst>
</story>`;
const rels = (items) => `<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Type="${type}" Target="${target}" Id="${id}" />`).join('')}</Relationships>`;

const zip = new JSZip();
zip.file('story/story.xml', story);
zip.file('story/_rels/story.xml.rels', rels([['RA', 'slide', '/story/slides/slide.xml'], ['RB', 'slide', '/story/slides/slide2.xml'], ['RC', 'slide', '/story/slides/slide3.xml'], ['RD', 'slide', '/story/slides/slide4.xml']]));
zip.file('story/slides/slide.xml', mc);
zip.file('story/slides/slide2.xml', match);
zip.file('story/slides/slide3.xml', fill);
zip.file('story/slides/slide4.xml', result);
zip.file('story/slideMasters/slideMaster.xml', '<?xml version="1.0" encoding="utf-8"?><master g="m1" name="Clean"><bg /><shapeLst /></master>');
zip.file('story/slideLayouts/slideLayout.xml', '<?xml version="1.0" encoding="utf-8"?><layout g="lay-file" internalG="lay-1" showMasterSp="false"><bg /><shapeLst /></layout>');
const path = join(mkdtempSync(join(tmpdir(), 'ef-storyq-')), 'Quiz sample.story');
writeFileSync(path, await zip.generateAsync({ type: 'nodebuffer' }));

const browser = await launch();
const ed = await editorPage(browser);
await ed.locator('input[aria-label="Storyline file"]').setInputFiles(path);
await ed.waitForSelector('.story-report');
const lead = await ed.locator('.story-report-lead').innerText();
check('four slides come in with nothing left unconverted', lead.startsWith('4 slides imported') && /Everything in the file/.test(lead), lead);
await ed.locator('.story-report .btn-accent').click();
const project = await ed.evaluate(() => window.__forgeStore.getState().project);
const [s1, s2, s3, s4] = project.slides;
const only = (s, type) => s.layers[0].blocks.filter((b) => b.type === type);

// Multiple choice
const q1 = only(s1, 'multipleChoice')[0];
check('the form question becomes one multiple choice block', !!q1 && s1.layers[0].blocks.length === 1, JSON.stringify(s1.layers[0].blocks.map((b) => b.type)));
if (q1) {
  eq('question text comes from its title box', q1.props.question, 'Which planet is red?');
  eq('choices are read top to bottom, labels from the Normal state', q1.props.choices.map((c) => c.text), ['Mars', 'Venus', 'Saturn']);
  eq('the right answer is the one Storyline marked', q1.props.correctChoiceIds, [q1.props.choices[0].id]);
  eq('feedback comes from the feedback layers', [q1.props.feedbackCorrect, q1.props.feedbackIncorrect], ['Mars it is.', 'Look again.']);
}
eq('its feedback layers are not kept as loose layers', s1.layers.length, 1);

// Matching
const q2 = only(s2, 'matching')[0];
check('matching by drag and drop becomes a matching block', !!q2, JSON.stringify(s2.layers[0].blocks.map((b) => b.type)));
if (q2) eq('each row keeps its own pair', q2.props.pairs.map((p) => [p.left, p.right]), [['Mercury', 'Closest to the Sun'], ['Jupiter', 'Largest planet']]);

// Fill in the blank
const q3 = only(s3, 'fillBlank')[0];
check('a freeform fill-in becomes a fill-in block where the field was', !!q3 && q3.x === 80 && q3.y === 200, JSON.stringify(q3 && [q3.x, q3.y]));
if (q3) eq('accepted answers', q3.props.correctAnswers, ['oxide', 'Oxide']);
check('the prompt text stays on the slide', only(s3, 'text').some((b) => /iron ___/.test(b.props.html)));
check('the old Submit button is gone, since the block checks itself', !s3.layers[0].blocks.some((b) => b.name === 'Submit'), JSON.stringify(s3.layers[0].blocks.map((b) => b.name)));

// Result slide
eq('the pass mark comes from the quiz', project.completion, { mode: 'allSlides', autoScore: true, passingScore: 60 });
const resText = only(s4, 'text').map((b) => b.props.html).join(' ');
check('score and pass mark read the built-in references', resText.includes('%Score%%') && resText.includes('%PassPercent%%') && !resText.includes('Quiz1'), resText);
const conds = s4.triggers.filter((t) => t.actions[0]?.type === 'showLayer').map((t) => t.conditions[0]);
eq('the result layers follow the score against the pass mark', conds.map((c) => [c.score, c.operator, c.value]), [[true, 'gte', 60], [true, 'lt', 60]]);
check('nothing is left as a "not converted" box', !project.slides.some((s) => s.layers.some((l) => l.blocks.some((b) => /not converted/.test(b.name ?? '')))));

// Play it: answer the multiple choice and the fill-in, then read the result slide.
const page = await playerPage(browser, project);
await page.locator('.mc-choice.live', { hasText: 'Mars' }).click();
await page.locator('.mc-submit.live').first().click();
await page.waitForTimeout(300);
check('the right choice shows the Storyline feedback', (await page.locator('.mc-feedback').innerText()).includes('Mars it is.'));
const next = async () => { await page.locator('button:has-text("Next")').first().focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500); };
await next(); await next();
await page.locator('.fb-input, input[type="text"]').first().fill('oxide');
await page.locator('.fb-check').first().click();
await page.waitForTimeout(300);
await next();
await page.waitForTimeout(500);
const body = await page.locator('.player-stage').innerText();
check('the result slide shows the live score and the pass mark', /YOUR SCORE: \d+%/.test(body) && body.includes('PASS MARK: 60%'), body.replace(/\s+/g, ' ').slice(0, 200));
// Two of three graded questions right is 67 percent, over the 60 pass mark.
check('the Success layer shows and the Failure layer does not', body.includes('You passed.') && !body.includes('Not yet.'), body.replace(/\s+/g, ' ').slice(0, 200));

await browser.close();
finish();
