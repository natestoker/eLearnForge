import { Runtime } from '../src/engine/runtime';
import { Scorm12Adapter } from '../src/tracking/scorm12';
import { Scorm2004Adapter } from '../src/tracking/scorm2004';
import { XapiAdapter } from '../src/tracking/xapi';
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
};
const w: any = { parent: null, opener: null, location: { search: '' } }; w.parent = w;
(globalThis as any).window = w;
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {} };
const sent: any[] = [];
(globalThis as any).fetch = (url: string, init: any) => { if (init?.body && url.endsWith('/statements')) sent.push(JSON.parse(init.body)); return Promise.resolve({}); };

const store: Record<string, string> = {}; const writes: string[] = [];
const api = (get: string, set: string, extra: any = {}) => ({
  [get]: (k: string) => k === 'cmi.interactions._count' ? '3' : (store[k] ?? ''),
  [set]: (k: string, v: string) => { store[k] = v; writes.push(k); return 'true'; }, ...extra });

const proj: any = { id: 'p', title: 'Demo', variables: [], completion: { mode: 'allSlides' },
  slides: [{ id: 's0', name: 's', width: 1, height: 1, triggers: [], layers: [{ id: 'l', name: 'b', visibleByDefault: true, blocks: [] }] }] };
const feed = (adapterEvents: (e: any) => void) => { const rt = new Runtime(proj); rt.onTrack(adapterEvents); return rt; };

const MC = { kind: 'choice', description: 'Which are red flags?', choices: ['Urgent tone', 'Known sender', 'Odd link'], learner: [2, 0], correct: [0, 2] } as const;
const SEQ = { kind: 'sequencing', description: 'Order', items: ['Spot', 'Report', 'Delete'], learner: [1, 0, 2], correct: [0, 1, 2] } as const;
const MAT = { kind: 'matching', description: 'Match', sources: ['A', 'B'], targets: ['x', 'y'], learner: [[0, 1], [1, 0]], correct: [[0, 0], [1, 1]] } as const;
const FIB = { kind: 'fill-in', description: 'Fill ___', learner: 'Phish', correct: ['phishing', 'phish'], caseSensitive: false } as const;

// ---------- SCORM 1.2
w.API = api('LMSGetValue', 'LMSSetValue', { LMSInitialize: () => 'true', LMSCommit: () => 'true', LMSFinish: () => 'true' });
let a: any = new Scorm12Adapter(); a.initialize('t');
let rt = feed((e) => a.handle(e));
rt.reportInteraction('q1', 'text', false, MC as any);
eq('1.2 starts after LMS _count (3)', store['cmi.interactions.3.id'], 'q1');
eq('1.2 type choice', store['cmi.interactions.3.type'], 'choice');
eq('1.2 response is sorted single chars', store['cmi.interactions.3.student_response'], '0,2'.replace('0,2', '0,2'));
eq('1.2 correct pattern', store['cmi.interactions.3.correct_responses.0.pattern'], '0,2');
eq('1.2 result wrong', store['cmi.interactions.3.result'], 'wrong');
eq('1.2 latency format', /^\d{4}:\d{2}:\d{2}\.\d{2}$/.test(store['cmi.interactions.3.latency']), true);
const idWrites = writes.filter(k => k.endsWith('.id')).length;
rt.reportInteraction('q1', 'text', true, { ...MC, learner: [0, 2] } as any);
eq('1.2 retry reuses entry (no 4th)', store['cmi.interactions.4.id'], undefined);
eq('1.2 retry updates result', store['cmi.interactions.3.result'], 'correct');
eq('1.2 retry does not rewrite id', writes.filter(k => k.endsWith('.id')).length, idWrites);
rt.reportInteraction('q2', 'x', true, SEQ as any);
eq('1.2 second question gets next index', [store['cmi.interactions.4.id'], store['cmi.interactions.4.type'], store['cmi.interactions.4.student_response']], ['q2', 'sequencing', '1,0,2']);
rt.reportInteraction('q3', 'x', false, MAT as any);
eq('1.2 matching pairs', [store['cmi.interactions.5.type'], store['cmi.interactions.5.student_response'], store['cmi.interactions.5.correct_responses.0.pattern']], ['matching', '0.1,1.0', '0.0,1.1']);
rt.reportInteraction('q4', 'x', true, FIB as any);
eq('1.2 fill-in', [store['cmi.interactions.6.type'], store['cmi.interactions.6.student_response'], store['cmi.interactions.6.correct_responses.0.pattern'], store['cmi.interactions.6.correct_responses.1.pattern']], ['fill-in', 'Phish', 'phishing', 'phish']);
rt.reportInteraction('q5', 'custom text', true);
eq('1.2 no detail -> performance + text', [store['cmi.interactions.7.type'], store['cmi.interactions.7.student_response']], ['performance', 'custom text']);

// ---------- SCORM 2004
for (const k of Object.keys(store)) delete store[k];
w.API = undefined;
w.API_1484_11 = api('GetValue', 'SetValue', { Initialize: () => 'true', Commit: () => 'true', Terminate: () => 'true' });
const b: any = new Scorm2004Adapter(); b.initialize('t');
rt = feed((e) => b.handle(e));
rt.reportInteraction('q1', 'text', false, MC as any);
eq('2004 choice response uses [,]', store['cmi.interactions.3.learner_response'], '0[,]2');
eq('2004 description set', store['cmi.interactions.3.description'], 'Which are red flags?');
eq('2004 result incorrect', store['cmi.interactions.3.result'], 'incorrect');
eq('2004 timestamp ISO', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(store['cmi.interactions.3.timestamp']), true);
eq('2004 latency ISO duration', /^PT\d+\.\d\dS$/.test(store['cmi.interactions.3.latency']), true);
rt.reportInteraction('q3', 'x', false, MAT as any);
eq('2004 matching uses [.] and [,]', store['cmi.interactions.4.learner_response'], '0[.]1[,]1[.]0');
rt.reportInteraction('q4', 'x', true, FIB as any);
eq('2004 fill-in patterns carry case_matters', [store['cmi.interactions.5.correct_responses.0.pattern'], store['cmi.interactions.5.correct_responses.1.pattern']], ['{case_matters=false}phishing', '{case_matters=false}phish']);
rt.reportInteraction('q5', 'custom', true);
eq('2004 no detail -> other', [store['cmi.interactions.6.type'], store['cmi.interactions.6.learner_response']], ['other', 'custom']);

// ---------- xAPI
w.location.search = '?endpoint=' + encodeURIComponent('https://lrs.test/xapi') + '&actor=' + encodeURIComponent(JSON.stringify({ mbox: 'mailto:l@x.test', objectType: 'Agent' })) + '&activity_id=' + encodeURIComponent('urn:course:1') + '&registration=r1';
const x: any = new XapiAdapter(); x.initialize('Demo');
sent.length = 0;
rt = feed((e) => x.handle(e));
rt.reportInteraction('q1', 'text', true, { ...MC, learner: [0, 2] } as any);
const st = sent.find(s => s.object.id.endsWith('/block/q1'));
eq('xapi verb answered', st.verb.id, 'http://adlnet.gov/expapi/verbs/answered');
eq('xapi object is cmi.interaction', [st.object.definition.type, st.object.definition.interactionType], ['http://adlnet.gov/expapi/activities/cmi.interaction', 'choice']);
eq('xapi choices', st.object.definition.choices.map((c: any) => c.id + ':' + c.description['en-US']), ['0:Urgent tone', '1:Known sender', '2:Odd link']);
eq('xapi correct pattern', st.object.definition.correctResponsesPattern, ['0[,]2']);
eq('xapi result', [st.result.success, st.result.response, st.result.completion, /^PT\d+\.\d\dS$/.test(st.result.duration)], [true, '0[,]2', true, true]);
eq('xapi attempt ext', st.result.extensions['https://elearnforge.com/xapi/extensions/attempt'], 1);
eq('xapi parent + registration', [st.context.registration, st.context.contextActivities.parent[0].id], ['r1', 'urn:course:1']);
rt.reportInteraction('q1', 'text', true, { ...MC, learner: [0, 2] } as any);
eq('xapi retry sends new statement with attempt 2', sent.filter(s => s.object.id.endsWith('/block/q1')).map(s => s.result.extensions['https://elearnforge.com/xapi/extensions/attempt']), [1, 2]);
rt.reportInteraction('q3', 'x', false, MAT as any);
const sm = sent.find(s => s.object.id.endsWith('/block/q3'));
eq('xapi matching source/target', [sm.object.definition.source.length, sm.object.definition.target.length, sm.object.definition.correctResponsesPattern], [2, 2, ['0[.]0[,]1[.]1']]);
rt.reportInteraction('q5', 'free text', true);
const so = sent.find(s => s.object.id.endsWith('/block/q5'));
eq('xapi no detail -> other + text response', [so.object.definition.interactionType, so.result.response], ['other', 'free text']);
// pass/fail verbs
sent.length = 0;
(x as any).handle({ type: 'scored', score: 90, passed: true, gated: true });
(x as any).handle({ type: 'completed', passed: true });
eq('xapi completed + passed w/ score', sent.map(s => s.verb.display['en-US']), ['scored', 'completed', 'passed']);
eq('passed statement carries score', sent[2].result.score.raw, 90);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
