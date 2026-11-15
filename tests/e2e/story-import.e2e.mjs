// File > Open Storyline (.story): a small package built here, in the same
// shape Storyline writes, comes in as slides, layers, variables and triggers.
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { check, eq, finish, launch, editorPage } from './harness.mjs';

const JSZip = createRequire(import.meta.url)('jszip');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const doc = (text, color = '#112233') => esc(`<Document><Content><Block><Style Justification="Center" LineSpacingRule="Single" /><Span Text="${text}"><Style FontFamily="+major" FontSize="18" FontIsBold="True" ForegroundColor="${color}" /></Span></Block></Content></Document>`);
const ctx = (start = 0, untilEnd = true) => `<tmCtxLst version="2"><tmCtx start="${start}" dur="${5000 - start}" untilEnd="${untilEnd}" /></tmCtxLst>`;
const trig = ({ event, action, sub = 'spec', inner = '', other = '', cond = '', enabled = true }) =>
  `<trig g="t-${Math.random()}"><data enabled="${enabled}" event="${event}" action="${action}" actSubType="${sub}"><keyPress keys="None" />${inner}<other ${other} /></data><condLst>${cond}</condLst></trig>`;

// 1x1 red PNG
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const pngHash = createHash('md5').update(png).digest('hex');

const story = `<?xml version="1.0" encoding="utf-8"?><story>
<varLst>
  <var g="v-builtin" name="Player.ZoomToFit" dataType="bool" val="false" type="builtIn" />
  <var g="v-seen" name="seenIntro" dataType="bool" val="False" type="user" />
  <var g="v-count" name="visits" dataType="num" val="2" type="user" />
</varLst>
<mediaLst><mediaLst><media g="asset-pic" type="Png"><md5Checksum><stream>${pngHash}</stream></md5Checksum></media></mediaLst></mediaLst>
<sceneLst>
  <scene g="sc1" name="Main" sceneType="scene"><sldIdLst><sldId>RB</sldId><sldId>RA</sldId></sldIdLst></scene>
  <scene g="sc2" name="Popups" sceneType="scene"><sldIdLst><sldId>RC</sldId></sldIdLst></scene>
</sceneLst>
<propLst><prop id="1"><sz w="960" h="540" /></prop></propLst>
</story>`;

// The scene lists RB first, so slide "Menu" (file slide2.xml) is slide 1.
const menu = `<?xml version="1.0" encoding="utf-8"?><sld g="sld-menu" name="Menu" layoutG="lay-1" advMode="user">
<tmProps min="5000" /><bg />
<shapeLst>
  <textBox g="shp-title" name="Title" rot="-1" vertAlign="m" horzAlign="c">${ctx()}<trigLst /><stateLst /><bG><noFill /></bG><loc l="40" t="30" r="640" b="90" /><animEffect><entr><fade dur="PT0.5S" /></entr></animEffect><text>${doc('Storyline menu')}</text><textMargin l="4" t="2" r="4" b="2" /></textBox>
  <pic g="shp-pic" name="Logo" rot="90" assetG="asset-pic">${ctx(500)}<trigLst /><stateLst /><bG /><loc l="700" t="40" r="800" b="140" /><animEffect /><alt>Company logo</alt></pic>
  <roundRect g="shp-go" name="Go" rot="-1" vertAlign="m" horzAlign="c">${ctx()}
    <trigLst>
      ${trig({ event: 'OnClick', action: 'jumpToSlide', inner: '<slide jumpG="sld-detail" />' })}
      ${trig({ event: 'OnClick', action: 'adjustVar', other: 'varG="v-count" op="add" dblVal="1"' })}
      ${trig({ event: 'OnClick', action: 'PrintSlide' })}
    </trigLst>
    <stateLst>
      <state name="Hover"><shapeLst><roundRect g="h1"><bG><solidFill><clr><srgbClr val="00AA00" /></clr></solidFill></bG><loc l="0" t="0" r="10" b="10" /></roundRect></shapeLst></state>
      <state name="Visited"><shapeLst><roundRect g="h2"><bG><solidFill><clr><schemeClr val="accent2" /></clr></solidFill></bG><loc l="0" t="0" r="10" b="10" /></roundRect></shapeLst></state>
    </stateLst>
    <bG><solidFill><clr><schemeClr val="accent1" /></clr></solidFill><solidLine><clr><srgbClr val="000000" /></clr></solidLine><lineStyle w="1.5" /></bG>
    <loc l="60" t="200" r="260" b="260" /><animEffect /><text>${doc('Open details', 'lt1,00')}</text><textMargin l="7" t="3" r="7" b="3" />
  </roundRect>
  <oval g="shp-info" name="Info" rot="-1">${ctx()}
    <trigLst>${trig({ event: 'OnClick', action: 'showSubSlide', inner: '<sldLayer showG="lay-more" />' })}${trig({ event: 'OnClick', action: 'LightboxSlide', inner: '<slide lightBoxG="sld-pop" />', cond: '<trigCond op="eq" boolVal="True" varG="v-seen" andOr="and"><shapeState shapeG="00000000-0000-0000-0000-000000000000" /></trigCond>' })}</trigLst>
    <stateLst /><bG><solidFill><clr><srgbClr val="FF8800" /></clr></solidFill><noLine /></bG><loc l="300" t="200" r="360" b="260" /><animEffect />
  </oval>
  <slider g="shp-slider" name="Volume slider" rot="-1">${ctx()}<trigLst /><stateLst /><bG /><loc l="400" t="300" r="700" b="340" /><animEffect /></slider>
</shapeLst>
<sldLayerLst>
  <sldLayer g="lay-more" name="More info" modal="false">
    <tmProps min="5000" /><bg />
    <shapeLst><textBox g="shp-more" name="More text" rot="-1">${ctx()}<trigLst /><stateLst /><bG><noFill /></bG><loc l="300" t="300" r="700" b="360" /><animEffect /><text>${doc('More about this')}</text></textBox></shapeLst>
    <trigLst>${trig({ event: 'OnStart', action: 'adjustVar', other: 'varG="v-seen" op="ass" boolVal="True"' })}</trigLst>
  </sldLayer>
</sldLayerLst>
<trigLst>
  ${trig({ event: 'OnNextButtonClick', action: 'jumpToSlide', sub: 'next' })}
  ${trig({ event: 'OnClick', action: 'jumpToSlide', inner: '<slide jumpG="sld-detail" />' }).replace('<data ', '<data NavigationIntent="Previous" ')}
</trigLst>
<note>${esc('<Document><Content><Block><Span Text="Say hello." /></Block></Content></Document>')}</note>
<navData prev="true" next="true" />
</sld>`;

const choice = (g, name, x) => `<oval g="${g}" name="${name}" rot="-1">${ctx()}<trigLst /><stateLst><state name="Selected"><shapeLst><oval g="${g}-sel"><bG><solidFill><clr><srgbClr val="FFCC00" /></clr></solidFill></bG><loc l="0" t="0" r="10" b="10" /></oval></shapeLst></state></stateLst><bG><solidFill><clr><srgbClr val="DDDDDD" /></clr></solidFill><noLine /></bG><loc l="${x}" t="200" r="${x + 80}" b="280" /><animEffect /></oval>`;
const fbLayer = (g, text) => `<feedBackLayer g="${g}" name="" modal="false"><tmProps min="5000" /><bg /><shapeLst><feedbackTextBox g="${g}-t" name="Feedback Text" rot="-1">${ctx()}<trigLst /><stateLst /><bG><noFill /></bG><loc l="300" t="400" r="700" b="460" /><animEffect /><text>${doc(text)}</text></feedbackTextBox></shapeLst><trigLst /></feedBackLayer>`;
const detail = `<?xml version="1.0" encoding="utf-8"?><sld g="sld-detail" name="Details" layoutG="lay-1"><tmProps min="5000" /><bg><solidFill><clr><srgbClr val="EEF2FF" /></clr></solidFill></bg>
<shapeLst><textBox g="shp-d" name="Body" rot="-1">${ctx()}<trigLst /><stateLst /><bG><noFill /></bG><loc l="40" t="40" r="600" b="100" /><animEffect /><text>${doc('Detail slide')}</text></textBox>
${choice('ch-a', 'Choice A', 60)}${choice('ch-b', 'Choice B', 200)}
<rect g="shp-submit" name="Submit" rot="-1">${ctx()}<trigLst>${trig({ event: 'OnClick', action: 'submitInteraction', inner: '<interaction submitG="q-1" />' }).replace('<other ', '<interaction submitG="q-1" /><other ')}</trigLst><stateLst /><bG><solidFill><clr><srgbClr val="222222" /></clr></solidFill><noLine /></bG><loc l="60" t="320" r="200" b="370" /><animEffect /></rect>
<freePickOneIntr g="q-1" name="" rot="-1">${ctx()}<loc l="0" t="0" r="960" b="540" /><intrProps corFbG="fb-right" incFbG="fb-wrong" tryFbG="00000000-0000-0000-0000-000000000000" thankFbG="00000000-0000-0000-0000-000000000000" /><choices><intrFreeChoice g="c1" shpG="ch-a" shpMainGrpG="ch-a"><scoringData correct="false" /></intrFreeChoice><intrFreeChoice g="c2" shpG="ch-b" shpMainGrpG="ch-b"><scoringData correct="true" /></intrFreeChoice></choices></freePickOneIntr>
</shapeLst>
<sldLayerLst>${fbLayer('fb-right', 'That is right')}${fbLayer('fb-wrong', 'Not this time')}</sldLayerLst>
<trigLst /><navData prev="true" next="false" /></sld>`;

const popup = `<?xml version="1.0" encoding="utf-8"?><sld g="sld-pop" name="Popup" layoutG="lay-1"><tmProps min="5000" /><bg />
<shapeLst><textBox g="shp-p" name="Pop" rot="-1">${ctx()}<trigLst /><stateLst /><bG><noFill /></bG><loc l="40" t="40" r="600" b="100" /><animEffect /><text>${doc('In a lightbox')}</text></textBox></shapeLst><trigLst /></sld>`;

const master = `<?xml version="1.0" encoding="utf-8"?><master g="m1" name="Clean"><bg><solidFill><clr><srgbClr val="FFFFFF" /></clr></solidFill></bg><shapeLst />
<clrLst name="Office"><dk1><srgbClr val="000000" /></dk1><lt1><srgbClr val="FFFFFF" /></lt1><accent1><srgbClr val="123ABC" /></accent1><accent2><srgbClr val="CC2255" /></accent2></clrLst>
<fonts name="x" major="Lato" minor="Lato" /></master>`;
const layout = `<?xml version="1.0" encoding="utf-8"?><layout g="lay-file" internalG="lay-1" showMasterSp="false"><bg /><shapeLst>
<textBox g="shp-foot" name="Footer" rot="-1">${ctx()}<trigLst /><stateLst /><bG><noFill /></bG><loc l="40" t="500" r="600" b="530" /><animEffect /><text>${doc('Confidential')}</text></textBox>
<ph g="shp-ph" name="Placeholder" /></shapeLst></layout>`;
const rels = (items) => `<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Type="${type}" Target="${target}" Id="${id}" />`).join('')}</Relationships>`;

const zip = new JSZip();
zip.file('story/story.xml', story);
zip.file('story/_rels/story.xml.rels', rels([['RA', 'slide', '/story/slides/slide.xml'], ['RB', 'slide', '/story/slides/slide2.xml'], ['RC', 'slide', '/story/slides/slide3.xml']]));
zip.file('story/slides/slide.xml', detail);
zip.file('story/slides/slide2.xml', menu);
zip.file('story/slides/slide3.xml', popup);
zip.file('story/slideMasters/slideMaster.xml', master);
zip.file('story/slideMasters/_rels/slideMaster.xml.rels', rels([['RL', 'slideLayout', '/story/slideLayouts/slideLayout.xml']]));
zip.file('story/slideLayouts/slideLayout.xml', layout);
zip.file('story/media/R5abc.png', png);
const path = join(mkdtempSync(join(tmpdir(), 'ef-story-')), 'Sample course.story');
writeFileSync(path, await zip.generateAsync({ type: 'nodebuffer' }));

const browser = await launch();
const ed = await editorPage(browser);
await ed.locator('input[aria-label="Storyline file"]').setInputFiles(path);
await ed.waitForSelector('.story-report');
const lead = await ed.locator('.story-report-lead').innerText();
check('the report says how many slides came in', lead.startsWith('3 slides imported'), lead);
const notes = await ed.locator('.story-report-list').innerText();
check('the unknown object is reported', notes.includes('Volume slider'), notes);
check('the unknown action is reported as kept in JavaScript', /PrintSlide/.test(notes), notes);
await ed.locator('.story-report .btn-accent').click();

const project = await ed.evaluate(() => window.__forgeStore?.getState().project ?? null);
check('the project is readable from the page', project !== null);
if (project) {
  const [s1, s2, s3] = project.slides;
  eq('slide order follows the scenes, not the file names', project.slides.map((s) => s.name), ['Menu', 'Details', 'Popup']);
  eq('title comes from the file name', project.title, 'Sample course');
  eq('slide size', [s1.width, s1.height], [960, 540]);
  eq('only the author\'s variables come in', project.variables.map((v) => [v.name, v.type, v.defaultValue]), [['seenIntro', 'boolean', false], ['visits', 'number', 2]]);
  const blocks = s1.layers[0].blocks;
  const by = (name) => blocks.find((b) => b.name === name);
  eq('layout artwork sits under the slide, locked', [blocks[0].name, blocks[0].locked], ['Footer', true]);
  const title = by('Title');
  check('text keeps its words, weight and size', /<strong>Storyline menu<\/strong>/.test(title.props.html) && title.props.fontSize === 24, JSON.stringify(title.props));
  eq('theme font and alignment', [title.props.fontFamily, title.props.align, title.props.valign], ['Lato', 'center', 'center']);
  eq('entrance animation and timing', [title.timing.animIn.type, title.timing.animIn.duration], ['fade', 0.5]);
  const pic = by('Logo');
  check('the picture is found by its checksum', pic.type === 'image' && pic.props.src.startsWith('data:image/png;base64,'), pic.type);
  eq('picture rotation, alt text and start time', [pic.rotation, pic.props.alt, pic.timing.start], [90, 'Company logo', 0.5]);
  const go = by('Go');
  eq('a filled shape keeps fill, outline and corner shape', [go.type, go.props.kind, go.props.fill, go.props.borderColor, go.props.borderWidth], ['shape', 'roundedRectangle', '#123ABC', '#000000', 2]);
  eq('states become state styles', [go.stateStyles.hover.fill, go.stateStyles.visited.fill], ['#00AA00', '#CC2255']);
  const goText = by('Go text');
  eq('shape text is white from the theme', goText.props.color, '#FFFFFF');
  check('the unknown object leaves a placeholder', Boolean(by('Volume slider (not converted)')));
  eq('layers come across, hidden to start', s1.layers.slice(1).map((l) => [l.name, l.visibleByDefault]), [['More info', false]]);
  eq('notes', s1.notes, 'Say hello.');
  eq('slide background', s2.background, { type: 'color', color: '#EEF2FF' });
  eq('a hidden Next button', s2.nav, { next: 'hide' });
  eq('a slide only opened as a lightbox becomes one', [s1.lightbox ?? false, s3.lightbox], [false, true]);

  const t = s1.triggers;
  const find = (pred) => t.find(pred);
  const jump = find((x) => x.event === 'onClick' && x.sourceBlockId === go.id && x.actions[0].type === 'goToSlide');
  eq('click jumps to the right slide', jump?.actions[0].slideId, s2.id);
  check('the click also works on the shape\'s text', Boolean(find((x) => x.event === 'onClick' && x.sourceBlockId === goText.id && x.actions[0].type === 'goToSlide')));
  eq('add to a number variable', find((x) => x.actions[0].type === 'adjustVariable')?.actions[0].delta, 1);
  const js = find((x) => x.actions[0].type === 'executeJs');
  check('an unknown action is kept as a JavaScript trigger that names it', /PrintSlide/.test(js?.actions[0].code ?? ''), js?.actions[0].code);
  const info = by('Info');
  eq('show layer', find((x) => x.sourceBlockId === info.id && x.actions[0].type === 'showLayer')?.actions[0].layerId, s1.layers[1].id);
  const lb = find((x) => x.actions[0].type === 'openLightbox');
  eq('lightbox with its condition', [lb?.actions[0].slideId, lb?.conditions[0].operator, lb?.conditions[0].value], [s3.id, 'eq', true]);
  const shown = find((x) => x.event === 'onLayerShown');
  eq('"when the layer starts" fires when the layer is shown', [shown?.layerId, shown?.actions[0].type, shown?.actions[0].value], [s1.layers[1].id, 'setVariable', true]);
  check('a plain Next trigger is dropped (the player already does it)', !find((x) => x.event === 'onNext'));
  eq('a custom Back action takes over the Back button', find((x) => x.event === 'onBack')?.actions[0].slideId, s2.id);
}

// ---- a pick-one question: choices select like radio buttons, Submit shows the right feedback
if (project) {
  const s2 = project.slides[1];
  const b = (name) => s2.layers[0].blocks.find((x) => x.name === name);
  eq('feedback layers come in, named by what they are for', s2.layers.slice(1).map((l) => l.name), ['Correct', 'Incorrect']);
  check('the question object itself leaves no placeholder', !s2.layers[0].blocks.some((x) => /not converted/.test(x.name ?? '')));
  check('choices can be selected', Boolean(b('Choice A').stateStyles.selected) && b('Choice B').stateStyles.selected.fill === '#FFCC00');
  const pickA = s2.triggers.find((t) => t.event === 'onClick' && t.sourceBlockId === b('Choice A').id);
  eq('choosing one clears the other', pickA.actions.map((a) => [a.blockId === b('Choice A').id ? 'A' : 'B', a.state]), [['A', 'selected'], ['B', 'normal']]);
  const submits = s2.triggers.filter((t) => t.sourceBlockId === b('Submit').id && t.actions[0].type === 'showLayer');
  eq('Submit has a right and a wrong trigger', submits.map((t) => [s2.layers.find((l) => l.id === t.actions[0].layerId).name, t.conditionLogic, t.conditions.map((c) => c.operator).join(',')]), [['Correct', 'and', 'ne,eq'], ['Incorrect', 'or', 'eq,ne']]);
}

// ---- it plays: layer shown -> variable set; custom Back; hidden layers on the canvas
eq('extra layers start hidden on the canvas', await ed.locator('.layer-item .eye.off').count(), 1);
await ed.getByRole('button', { name: /Preview/ }).first().click();
await ed.locator('.menu-item', { hasText: 'Preview project' }).click();
await ed.waitForSelector('.preview-overlay .player');
await ed.waitForTimeout(900);
const P = ed.locator('.preview-overlay');
await P.locator('.player-inspector-btn').click();
const value = async (name) => (await P.locator('.player-inspector-row', { hasText: name }).locator('.player-inspector-val').innerText()).trim();
eq('seenIntro starts false', await value('seenIntro'), 'false');
await P.locator('.player-block.clickable').nth(2).click({ force: true });
await ed.waitForTimeout(500);
check('clicking Info shows the layer', (await P.locator('.player-stage').innerText()).includes('More about this'));
eq('showing the layer ran its trigger', await value('seenIntro'), 'true');
await P.locator('button', { hasText: /^Back$/ }).click();
await ed.waitForTimeout(700);
check('Back followed its custom trigger to Details', (await P.locator('.player-stage').innerText()).includes('Detail slide'));
const tap = async (name) => { const id = await ed.evaluate((n) => window.__forgeStore.getState().project.slides[1].layers[0].blocks.find((x) => x.name === n).id, name); await P.locator(`[data-block-id="${id}"]`).click({ force: true }); await ed.waitForTimeout(350); };
await tap('Choice A'); await tap('Submit');
check('a wrong answer shows the Incorrect feedback', (await P.locator('.player-stage').innerText()).includes('Not this time'));


await browser.close();
finish();
