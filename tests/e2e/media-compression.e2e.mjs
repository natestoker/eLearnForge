// The Publish "Compress" engine on real generated media: image, audio, video, and cancel.
import { build } from 'esbuild';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { check, eq, finish, launch } from './harness.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname);
const out = join(mkdtempSync(join(tmpdir(), 'ef-compress-')), 'compress.js');
await build({ entryPoints: [join(root, 'src/publish/compress.ts')], bundle: true, format: 'iife', globalName: 'Compress', outfile: out, logLevel: 'error' });

const browser = await launch();
const page = await browser.newPage();
await page.goto('about:blank');
await page.addScriptTag({ content: readFileSync(out, 'utf8') });

const r = await page.evaluate(async () => {
  const res = {};
  { // 3000x2000 PNG
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 3000, 2000); g.addColorStop(0, '#3a7'); g.addColorStop(1, '#a37'); x.fillStyle = g; x.fillRect(0, 0, 3000, 2000);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `hsl(${i % 360},60%,50%)`; x.fillRect(Math.random() * 3000, Math.random() * 2000, 40, 40); }
    const url = c.toDataURL('image/png'); const k = await Compress.compressMedia(url);
    const img = new Image(); img.src = k.dataUrl; await img.decode();
    res.image = { ratio: k.after / k.before, mime: Compress.mimeOf(k.dataUrl), w: img.naturalWidth, h: img.naturalHeight };
  }
  { // 20 s stereo WAV
    const sr = 44100, n = sr * 20, len = n * 4 + 44, ab = new ArrayBuffer(len), v = new DataView(ab); const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, len - 8, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
    let o = 44; for (let i = 0; i < n; i++) for (let ch = 0; ch < 2; ch++) { v.setInt16(o, (Math.sin(i / 20 + ch) * 0.4 + (Math.random() - 0.5) * 0.05) * 32767, true); o += 2; }
    const url = await new Promise((rs) => { const f = new FileReader(); f.onload = () => rs(f.result); f.readAsDataURL(new Blob([ab], { type: 'audio/wav' })); });
    const k = await Compress.compressMedia(url); res.audio = { ratio: k.after / k.before, mime: Compress.mimeOf(k.dataUrl) };
  }
  { // 4 s video + tone at 8 Mbps
    const c = document.createElement('canvas'); c.width = 640; c.height = 360; const x = c.getContext('2d');
    const ac = new AudioContext(); const osc = ac.createOscillator(); const dest = ac.createMediaStreamDestination(); osc.connect(dest); osc.start();
    const stream = c.captureStream(30); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 8_000_000 }); const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data); const done = new Promise((rs) => { rec.onstop = rs; }); rec.start(500);
    const t0 = performance.now(); await new Promise((rs) => { const d = () => { const t = (performance.now() - t0) / 1000; for (let i = 0; i < 200; i++) { x.fillStyle = `hsl(${(t * 90 + i * 7) % 360},70%,50%)`; x.fillRect(Math.random() * 640, Math.random() * 360, 60, 60); } if (t < 4) requestAnimationFrame(d); else rs(); }; d(); });
    rec.stop(); await done; osc.stop();
    const url = await new Promise((rs) => { const f = new FileReader(); f.onload = () => rs(f.result); f.readAsDataURL(new Blob(chunks, { type: 'video/webm' })); });
    const steps = []; const k = await Compress.compressMedia(url, (p) => steps.push(p));
    res.video = { ratio: k.after / k.before, mime: Compress.mimeOf(k.dataUrl), progressSteps: steps.length };
    // cancel
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 1200);
    try { await Compress.compressMedia(url, undefined, ctl.signal); res.cancel = 'finished'; } catch (e) { res.cancel = e.name; }
  }
  return res;
});

check('image: scaled to 1920px and re-encoded as WebP, far smaller', r.image.mime === 'image/webp' && r.image.w === 1920 && r.image.ratio < 0.4, JSON.stringify(r.image));
check('audio: converted to MP3, far smaller', r.audio.mime === 'audio/mpeg' && r.audio.ratio < 0.2, JSON.stringify(r.audio));
check('video: re-encoded, smaller, with progress', r.video.mime === 'video/webm' && r.video.ratio < 0.6 && r.video.progressSteps > 3, JSON.stringify(r.video));
eq('video compression can be cancelled', r.cancel, 'AbortError');

// path helpers used by the dialog to swap a file inside the project
const paths = await page.evaluate(() => { const o = { a: [{ b: 'x' }] }; Compress.setAtPath(o, ['a', 0, 'b'], 'y'); return [Compress.getAtPath(o, ['a', 0, 'b']), o.a[0].b]; });
eq('setAtPath and getAtPath address nested media', paths, ['y', 'y']);

await browser.close();
finish();
