// Runs every tests/*.test.ts: bundles it with esbuild (already installed as a
// Vite dependency) and runs it in Node. A test file prints its own results and
// exits non-zero on failure. No test framework needed.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const dir = join(root, 'tests');
const out = mkdtempSync(join(tmpdir(), 'elearnforge-tests-'));
const only = process.argv[2];
const files = readdirSync(dir).filter((f) => f.endsWith('.test.ts') && (!only || f.includes(only)));
let failed = 0;

for (const f of files) {
  const outfile = join(out, f.replace(/\.ts$/, '.cjs'));
  await build({ entryPoints: [join(dir, f)], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error' });
  console.log(`\n== ${f}`);
  const r = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
rmSync(out, { recursive: true, force: true });
console.log(failed ? `\n${failed} of ${files.length} test files FAILED` : `\nAll ${files.length} test files passed`);
process.exit(failed ? 1 : 0);
