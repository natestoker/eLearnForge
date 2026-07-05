import JSZip from 'jszip';
import { googleFontsHref } from '../shared/fonts';
import type { Project } from '../schema/types';
import type { PublishTarget } from '../tracking';
import { activityIdFor, scorm12Manifest, scorm2004Manifest, tincanXml } from './manifests';
import { storylineReadme, storylineSnippet } from './storylineSnippet';
import { riseReadme, riseSnippet } from './riseSnippet';
// Baked at build time by the forgePlayerHtml vite plugin: the fully built,
// single-file player.html as a string. Empty in dev mode.
import playerHtml from 'virtual:player-html';

export interface PublishResult {
  filename: string;
  blob: Blob;
}

export function publishAvailable(): boolean {
  return playerHtml.length > 0;
}

// Embed the project JSON and the publish flag into the player HTML. The
// JSON goes into an inert script tag; '<' is escaped so learner content
// containing "</script>" can never break out of the tag.
export function buildPublishedHtml(project: Project, target: PublishTarget | 'rise'): string {
  const json = JSON.stringify(project).replace(/</g, '\\u003c');
  // Preload any Google fonts the project uses so published text renders in
  // the chosen face without a flash (the app also lazy-loads them, but the
  // link here covers the very first paint).
  const fontLink = project.fonts && project.fonts.length
    ? `<link rel="stylesheet" href="${googleFontsHref(project.fonts)}">\n`
    : '';
  // Fonts embedded from an imported PowerPoint travel with the course as
  // @font-face data URLs so the deck's own typeface renders offline.
  const embeddedCss = (project.embeddedFonts ?? [])
    .map((f) =>
      `@font-face{font-family:'${f.family}';src:url(${f.dataUrl});` +
      `font-weight:${f.weight ?? 400};font-style:${f.italic ? 'italic' : 'normal'};font-display:swap;}`
    )
    .join('');
  const embeddedStyle = embeddedCss ? `<style>${embeddedCss}</style>\n` : '';
  const inject =
    fontLink +
    embeddedStyle +
    `<script>window.FORGE_PUBLISH = { target: ${JSON.stringify(target)} };</script>\n` +
    `<script id="forge-project" type="application/json">${json}</script>\n`;
  // Insert right after <head> opens so the flag exists before the app boots.
  const marker = /<head>/i;
  if (marker.test(playerHtml)) return playerHtml.replace(marker, (m) => `${m}\n${inject}`);
  return inject + playerHtml;
}

function slugFile(title: string): string {
  const s = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'course';
}

export async function buildPackage(project: Project, target: PublishTarget | 'rise'): Promise<PublishResult> {
  const base = slugFile(project.title);
  // Rise rides the storyline adapter: same postMessage contract, different
  // receiving end (the code block snippet instead of an SL trigger).
  const html = buildPublishedHtml(project, target === 'rise' ? 'storyline' : target);

  if (target === 'web') {
    return {
      filename: `${base}.html`,
      blob: new Blob([html], { type: 'text/html' })
    };
  }

  const zip = new JSZip();
  zip.file('index.html', html);

  switch (target) {
    case 'scorm12':
      zip.file('imsmanifest.xml', scorm12Manifest(project.title));
      break;
    case 'scorm2004':
      zip.file('imsmanifest.xml', scorm2004Manifest(project.title));
      break;
    case 'xapi':
      zip.file('tincan.xml', tincanXml(project.title, activityIdFor(project.title)));
      break;
    case 'storyline':
      zip.file('storyline-bridge.js', storylineSnippet(project));
      zip.file('README.txt', storylineReadme(project));
      break;
    case 'rise':
      zip.remove('index.html');
      zip.file('course.html', html);
      zip.file('rise-code-block.html', riseSnippet(project));
      zip.file('README.txt', riseReadme(project));
      break;
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const suffix =
    target === 'scorm12' ? 'scorm12' :
    target === 'scorm2004' ? 'scorm2004' :
    target === 'xapi' ? 'xapi' :
    target === 'rise' ? 'rise-code-block' : 'storyline-webobject';
  return { filename: `${base}-${suffix}.zip`, blob };
}

export function downloadBlob(result: PublishResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
