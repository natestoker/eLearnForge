import { Scorm12Adapter } from '../src/tracking/scorm12';
import { Scorm2004Adapter } from '../src/tracking/scorm2004';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
};
const mkStore = () => {
  const store: Record<string, string> = {};
  return { store, get: (k: string) => store[k] ?? '', set: (k: string, v: string) => { store[k] = v; return 'true'; } };
};
const w: any = { parent: null, opener: null };
w.parent = w;
(globalThis as any).window = w;

const a = mkStore();
w.API = { LMSInitialize: () => 'true', LMSGetValue: a.get, LMSSetValue: a.set, LMSCommit: () => 'true', LMSFinish: () => 'true', LMSGetLastError: () => '0' };
const s12 = new Scorm12Adapter(); s12.initialize('t');
s12.handle({ type: 'scored', score: 70, passed: false, gated: true });
eq('1.2 gated fail', a.store['cmi.core.lesson_status'], 'failed');
s12.handle({ type: 'scored', score: 90, passed: true, gated: true });
s12.handle({ type: 'completed', passed: true });
eq('1.2 gated pass', a.store['cmi.core.lesson_status'], 'passed');

const b = mkStore();
w.API = { LMSInitialize: () => 'true', LMSGetValue: b.get, LMSSetValue: b.set, LMSCommit: () => 'true', LMSFinish: () => 'true', LMSGetLastError: () => '0' };
const t = new Scorm12Adapter(); t.initialize('t');
t.handle({ type: 'scored', score: 50, passed: false, gated: false });
t.handle({ type: 'completed' });
eq('1.2 ungated keeps completed', [b.store['cmi.core.lesson_status'], b.store['cmi.core.score.raw']], ['completed', '50']);

const c = mkStore();
w.API = undefined;
w.API_1484_11 = { Initialize: () => 'true', GetValue: c.get, SetValue: c.set, Commit: () => 'true', Terminate: () => 'true', GetLastError: () => '0' };
const s04 = new Scorm2004Adapter(); s04.initialize('t');
s04.handle({ type: 'scored', score: 75, passed: false, gated: false });
eq('2004 below pass mark', c.store['cmi.success_status'], 'failed');
s04.handle({ type: 'scored', score: 75, passed: true, gated: false });
eq('2004 at or above pass mark', [c.store['cmi.success_status'], c.store['cmi.score.scaled']], ['passed', '0.75']);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
