import { Runtime } from '../src/engine/runtime';
import { variableLabel, variableOwner } from '../src/shared/variableLabel';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`);
};
const blk = (id: string, name?: string) => ({ id, type: 'multipleChoice', props: {}, ...(name ? { name } : {}) }) as any;
const proj = (extra: any = {}) => ({
  id: 'p', title: 't',
  variables: [
    { id: 'v1', name: 'mc_blk_abc123_correct', type: 'boolean', defaultValue: false },
    { id: 'v2', name: 'score_flag', type: 'number', defaultValue: 0 },
    { id: 'v3', name: 'mc_blk_gone99_correct', type: 'boolean', defaultValue: false }
  ],
  slides: [{ id: 's0', name: 's0', width: 1, height: 1, triggers: extra.triggers ?? [], layers: [{ id: 'l', name: 'b', visibleByDefault: true, blocks: [blk('blk_abc123', 'Knowledge check')] }] }]
}) as any;

// timeline start event
let fired = 0;
const p = proj({ triggers: [{ id: 't1', event: 'onTimelineStart', conditions: [], actions: [{ type: 'setScore', score: 33 }] }] });
const rt = new Runtime(p);
rt.timelineStarted();
eq('onTimelineStart fires', rt.getScore(), 33);
const quiet = new Runtime(proj());
quiet.timelineStarted();
eq('no trigger, no score', quiet.getScore(), null);

// friendly variable names
const pr = proj();
eq('auto variable gets a readable label', variableLabel(pr, pr.variables[0]), 'Knowledge check: correct');
eq('author variable is shown as typed', variableLabel(pr, pr.variables[1]), 'score_flag');
eq('auto variable of a deleted block falls back to its name', variableLabel(pr, pr.variables[2]), 'mc_blk_gone99_correct');
eq('owner lookup', variableOwner(pr, pr.variables[0])?.what, 'correct');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
