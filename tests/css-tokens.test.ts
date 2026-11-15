import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Keeps the editor chrome on the design tokens: a new literal font-size or
// border-radius in a chrome rule fails here. Course content (quiz blocks, the
// player) is exempt, and so is :root, where the tokens are defined.
const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const CONTENT = /\.(player|lg-|seq-|mc-|dd-|sc-|statement|code-|match-|rs-|text-block|pw-|slider-|image-|hotspot|fb-|vd-|fc-|cl-|tabs-block|tab-btn|acc-|timer|audio-|te-|attempts|lightbox|btn-block|cc-|caption|cs-pv)/;
const bad: string[] = [];
const re = /([^{}]+)\{([^{}]*)\}/g;
let m: RegExpExecArray | null;
while ((m = re.exec(css))) {
  const sel = m[1].trim().split('\n').pop()!.trim();
  if (sel.includes(':root') || CONTENT.test(sel) || sel.startsWith('@')) continue;
  for (const d of m[2].split(';')) {
    const hit = /^\s*(font-size|border-radius)\s*:\s*([0-9.]+px)\s*$/.exec(d);
    if (hit && hit[2] !== '0px') bad.push(`${sel} { ${hit[1]}: ${hit[2]} }`);
  }
}
console.log(bad.length ? `FAIL ${bad.length} chrome rules use a literal size instead of a token:\n  ` + bad.slice(0, 20).join('\n  ') : 'ok   chrome font sizes and radii all come from tokens');
process.exit(bad.length ? 1 : 0);
