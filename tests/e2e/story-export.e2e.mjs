// File > Save as Storyline (.story): the saved package has the parts Storyline
// expects, and opening it again brings the slides back.
import { createRequire } from 'node:module';
import { readFileSync, copyFileSync } from 'node:fs';
import { check, eq, finish, launch, editorPage } from './harness.mjs';

const JSZip = createRequire(import.meta.url)('jszip');
const browser = await launch();
const ed = await editorPage(browser);
const before = await ed.evaluate(() => {
  const p = window.__forgeStore.getState().project;
  return { slides: p.slides.map((s) => s.name), vars: p.variables.map((v) => v.name), layers: p.slides.map((s) => s.layers.length), quiz: p.slides.map((s) => s.layers[0].blocks.some((b) => ['multipleChoice', 'dragDrop', 'matching', 'sequence'].includes(b.type))), tabs: p.slides.map((s) => s.layers[0].blocks.filter((b) => b.type === 'tabs').reduce((n, b) => n + b.props.panels.length, 0)) };
});

await ed.getByRole('button', { name: /^File/ }).click();
const [download] = await Promise.all([
  ed.waitForEvent('download'),
  ed.locator('.menu-item', { hasText: 'Save as Storyline' }).click()
]);
const path = await download.path();
if (process.env.STORY_OUT) copyFileSync(path, process.env.STORY_OUT);
check('the file is named after the course', download.suggestedFilename().endsWith('.story'), download.suggestedFilename());
await ed.waitForSelector('.story-report');
check('the report lists what could not be saved as it was', (await ed.locator('.story-report-list li').count()) > 0);
await ed.locator('.story-report .btn-accent').click();

const zip = await JSZip.loadAsync(readFileSync(path));
const text = async (p) => (await zip.file(p).async('string')).replace(/^\uFEFF/, '');
const story = await text('story/story.xml');
const rels = await text('story/_rels/story.xml.rels');
const types = await text('[Content_Types].xml');
const slideRels = [...rels.matchAll(/Type="slide" Target="\/([^"]+)" Id="([^"]+)"/g)];
eq('one slide part per slide', slideRels.length, before.slides.length);
check('every slide part exists and is declared', slideRels.every((m) => zip.file(m[1]) && types.includes(`PartName="/${m[1]}"`)));
eq('the scene lists the slides in order', [...story.match(/<sldIdLst>(.*?)<\/sldIdLst>/)[1].matchAll(/<sldId>([^<]+)/g)].map((m) => m[1]), slideRels.map((m) => m[2]));
check('the masters, theme and player settings from the blank project are kept', ['story/playerProps.xml', 'story/theme/theme.xml', 'story/slideMasters/slideMaster.xml'].every((p) => zip.file(p)));
check('variables are written as user variables', before.vars.every((v) => new RegExp(`name="${v.replace(/[^A-Za-z0-9_]/g, '_')}"[^>]*type="user"`).test(story)));
check('the zip lists no folders (Storyline rejects them)', Object.keys(zip.files).every((f) => !f.endsWith('/')), Object.keys(zip.files).filter((f) => f.endsWith('/')).join(' '));
const s1 = await text(slideRels[0][1]);
check('slide 1 has its name and text', s1.includes(`name="${before.slides[0]}"`) && s1.includes('<textBox ') && s1.includes('&lt;Span Text='));
const allSlides = (await Promise.all(slideRels.map((m) => text(m[1])))).join('');
const assets = [...new Set([...allSlides.matchAll(/<pic [^>]*assetG="([^"]+)"/g)].map((m) => m[1]))];
check('every picture has a media entry and a file', assets.every((g) => story.includes(`<media g="${g}"`)) && [...story.matchAll(/<media g=/g)].length === Object.keys(zip.files).filter((f) => /^story\/media\/R.*\.png$/.test(f)).length);
const themeXml = await text('story/theme/theme.xml');
check('pictures are listed in the theme as well', assets.every((g) => themeXml.includes(`<media g="${g}"`)));
const b62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const partId = (g) => { const p = g.split('-'); let v = BigInt('0x' + p[0]) | (BigInt('0x' + p[1]) << 32n) | (BigInt('0x' + p[2]) << 48n); let o = ''; while (v > 0n) { o = b62[Number(v % 62n)] + o; v /= 62n; } return 'R' + o; };
check('each picture file is named after its asset id, as Storyline requires', assets.every((g) => zip.file(`story/media/${partId(g)}.png`)));
const quizSlide = (await Promise.all(slideRels.map((m) => text(m[1])))).find((x) => x.includes('<freePickOneIntr') || x.includes('<freePickManyIntr'));
check('no block is left as a "not converted" box in the demo course', !allSlides.includes('not converted'));
check('drag and drop is a freeform drag-and-drop question', allSlides.includes('<dragDropIntr') && /matchShpG="(?!00000000)/.test(allSlides));
check('the quiz block is written as a freeform question', Boolean(quizSlide) && quizSlide.includes('layoutType="Quiz Questions"') && quizSlide.includes('action="submitInteraction"'));
check('its choices have Normal, Hover and Selected states', ['Normal', 'Hover', 'Selected'].every((n) => quizSlide.includes(`name="${n}"`)));
check('every choice the question lists is a shape on the slide, and both feedback layers exist', [...quizSlide.matchAll(/(?:shpG|corFbG|incFbG|submitG)="([^"]+)"/g)].every((m) => m[1].startsWith('00000000') || quizSlide.includes(` g="${m[1]}"`)));
check('every GUID a trigger points at exists', [...allSlides.matchAll(/(?:jumpG|showG|setStateG|lightBoxG)="([^"]+)"/g)].every((m) => allSlides.includes(`g="${m[1]}"`)));

// Round trip: open what was just saved.
await ed.locator('input[aria-label="Storyline file"]').setInputFiles({ name: 'Round trip.story', mimeType: 'application/octet-stream', buffer: readFileSync(path) });
await ed.waitForSelector('.story-report');
await ed.locator('.story-report .btn-accent').click();
const after = await ed.evaluate(() => {
  const p = window.__forgeStore.getState().project;
  return { slides: p.slides.map((s) => s.name), vars: p.variables.map((v) => v.name), layers: p.slides.map((s) => s.layers.length), text: p.slides[0].layers[0].blocks.filter((b) => b.type === 'text').length, quizTriggers: p.slides.flatMap((s) => s.triggers.filter((t) => t.actions[0].type === 'showLayer' && ['Correct', 'Incorrect'].includes(s.layers.find((l) => l.id === t.actions[0].layerId)?.name))).length, jumps: p.slides.flatMap((s) => s.triggers).filter((t) => ['goToSlide', 'nextSlide'].includes(t.actions[0].type)).length };
});
eq('slides survive the round trip', after.slides, before.slides);
// A quiz block is saved as a Storyline question, which adds its two feedback layers.
// A tab set adds a layer per panel as well.
eq('layers survive the round trip (a question adds Correct and Incorrect, tabs add one per panel)', after.layers, before.layers.map((n, i) => n + (before.quiz[i] ? 2 : 0) + before.tabs[i]));
check('the question comes back as a working pick question', after.quizTriggers >= 2, String(after.quizTriggers));
// The demo shows a score, so the export adds a Score number that each
// question's Correct layer feeds.
eq('variables survive the round trip (plus the added Score)', after.vars, [...before.vars.map((v) => v.replace(/[^A-Za-z0-9_]/g, '_')), 'Score']);
check('the score readout uses the Score variable, fed by the Correct layers', allSlides.includes('%Score%') && /<feedBackLayer(?:(?!<\/feedBackLayer>).)*action="adjustVar"/s.test(allSlides) && !allSlides.includes('@@SCORE_STEP@@'));
// Storyline rejects the whole file if a text margin has a decimal.
check('text margins are whole numbers', !/<textMargin [^>]*"-?\d+\.\d/.test(allSlides));
check('shapes whose text fits keep a fixed size', /autoFit="none"[^>]*>(?:(?!<\/textBox>).)*<text>/s.test(allSlides));
check('font sizes are scaled to the slide width', !/FontSize="(?:[4-9]\d|\d{3,})/.test(allSlides));
check('text comes back as text', after.text > 0);

// Narration: a WAV clip with captions goes out as MP3 plus a caption file,
// and comes back as an audio block with the captions on the slide.
const wav = await ed.evaluate(() => {
  const rate = 22050, n = rate, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / rate * 2 * Math.PI * 440) * 8000, true);
  let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return 'data:audio/wav;base64,' + btoa(s);
});
await ed.evaluate((src) => window.__forgeStore.getState().setProject({ id: 'p', title: 'Narrated', variables: [], slides: [{ id: 's1', name: 'Narrated', width: 1280, height: 720, triggers: [], timeline: { duration: 5, autoAdvance: false, captionsVtt: 'WEBVTT\n\n00:00:00.100 --> 00:00:00.900\nA short tone\n' }, layers: [{ id: 'l1', name: 'Base layer', visibleByDefault: true, blocks: [{ id: 'a1', type: 'audio', name: 'Narration', x: 20, y: 20, w: 240, h: 44, timing: { start: 0.5 }, props: { src, controls: false, autoplay: true, label: 'Narration', hideInPlayer: true } }] }] }] }), wav);
await ed.waitForTimeout(300);
await ed.getByRole('button', { name: /^File/ }).click();
const [adl] = await Promise.all([ed.waitForEvent('download'), ed.locator('.menu-item', { hasText: 'Save as Storyline' }).click()]);
const apath = await adl.path();
await ed.waitForSelector('.story-report'); await ed.locator('.story-report .btn-accent').click();
const az = await JSZip.loadAsync(readFileSync(apath));
const aNames = Object.keys(az.files);
const aStory = await az.file('story/story.xml').async('string');
const aSlide = await az.file('story/slides/slide.xml').async('string');
const mp3Name = aNames.find((n) => n.endsWith('.mp3'));
check('the clip is stored as MP3 with a caption file', !!mp3Name && aNames.some((n) => n.endsWith('.vtt')));
check('the MP3 is a real MPEG stream', !!mp3Name && (await az.file(mp3Name).async('uint8array')).some((b, i, a) => b === 0xff && (a[i + 1] & 0xe0) === 0xe0));
check('the clip is listed in the story and the theme, pointing at its captions', /<audio g="[^"]+"[^>]*ClosedCaptionsAssetGuid="[^"]+" hasClosedCaptions="true"/.test(aStory) && (await az.file('story/theme/theme.xml').async('string')).includes('<audio g='));
check('content types cover mp3 and vtt', /Extension="mp3"/.test(await az.file('[Content_Types].xml').async('string')) && /Extension="vtt"/.test(await az.file('[Content_Types].xml').async('string')));
const snd = /<sndTmCtx [^>]*start="(\d+)" dur="(\d+)"/.exec(aSlide);
check('the sound sits on the timeline at its start time for its real length', !!snd && snd[1] === '500' && Math.abs(Number(snd[2]) - 1000) < 120, snd ? `${snd[1]} ${snd[2]}` : 'no sound');
await ed.locator('input[aria-label="Storyline file"]').setInputFiles({ name: 'Narrated.story', mimeType: 'application/octet-stream', buffer: readFileSync(apath) });
await ed.waitForSelector('.story-report'); await ed.locator('.story-report .btn-accent').click();
const aAfter = await ed.evaluate(() => { const s = window.__forgeStore.getState().project.slides[0]; const a = s.layers[0].blocks.find((b) => b.type === 'audio'); return { audio: !!a && String(a.props.src).startsWith('data:audio/'), start: a?.timing?.start, cc: s.timeline?.captionsVtt ?? '' }; });
check('the clip comes back as an audio block at the same start', aAfter.audio && Math.abs((aAfter.start ?? 0) - 0.5) < 0.01, JSON.stringify({ audio: aAfter.audio, start: aAfter.start }));
check('the captions come back on the slide', aAfter.cc.includes('A short tone') && aAfter.cc.startsWith('WEBVTT'), aAfter.cc.slice(0, 80));

await browser.close();
finish();
