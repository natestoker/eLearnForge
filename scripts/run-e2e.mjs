// Runs the browser suites in tests/e2e against the built app. Serves dist/ on a
// local port, then runs each *.e2e.mjs in its own Node process.
// Needs: `npm run build` first, and Chromium (`npx playwright install chromium`).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) { console.error('dist/ is missing. Run `npm run build` first.'); process.exit(2); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  const file = join(dist, path === '/' ? 'index.html' : path);
  if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const dir = join(root, 'tests/e2e');
const only = process.argv[2];
const files = readdirSync(dir).filter((f) => f.endsWith('.e2e.mjs') && (!only || f.includes(only)));
let failed = 0;
for (const f of files) {
  console.log(`\n== ${f}`);
  // Async on purpose: the static server above lives in this process, so a
  // blocking spawn would freeze it while the browser waits for pages.
  const code = await new Promise((resolveExit) => {
    spawn(process.execPath, [join(dir, f)], { stdio: 'inherit', env: { ...process.env, E2E_BASE_URL: base } }).on('exit', resolveExit);
  });
  if (code !== 0) failed++;
}
server.close();
console.log(failed ? `\n${failed} of ${files.length} browser suites FAILED` : `\nAll ${files.length} browser suites passed`);
process.exit(failed ? 1 : 0);
