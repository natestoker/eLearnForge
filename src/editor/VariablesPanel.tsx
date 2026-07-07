import type { Variable } from '../schema/types';
import { useProjectStore } from '../state/projectStore';
import { uid } from '../schema/factory';
import { SelectInput } from './fields';
import { ValueInput } from './TriggersPanel';

export function VariablesPanel() {
  const variables = useProjectStore((s) => s.project.variables);
  const mutate = useProjectStore((s) => s.mutate);

  const edit = (id: string, fn: (v: Variable) => void) =>
    mutate((p) => {
      const v = p.variables.find((vr) => vr.id === id);
      if (v) fn(v);
    });

  return (
    <div className="panel-scroll">
      <div className="panel-title-row">
        <h3 className="panel-title">Project variables</h3>
        <button
          className="btn btn-accent"
          onClick={() =>
            mutate((p) => {
              p.variables.push({
                id: uid('var'),
                name: `variable_${p.variables.length + 1}`,
                type: 'boolean',
                defaultValue: false
              });
            })
          }
        >
          + Variable
        </button>
      </div>

      {variables.length === 0 && (
        <p className="empty-note">
          No variables yet. Multiple choice blocks create theirs automatically on insert.
        </p>
      )}

      {variables.map((v) => (
        <div key={v.id} className="variable-card">
          <input
            className="input"
            type="text"
            value={v.name}
            onChange={(e) => edit(v.id, (vr) => { vr.name = e.target.value; })}
          />
          <div className="trigger-row">
            <SelectInput
              value={v.type}
              options={[
                { value: 'boolean', label: 'boolean' },
                { value: 'number', label: 'number' },
                { value: 'string', label: 'string' }
              ]}
              onChange={(t) =>
                edit(v.id, (vr) => {
                  vr.type = t as Variable['type'];
                  vr.defaultValue = t === 'boolean' ? false : t === 'number' ? 0 : '';
                })
              }
            />
            <ValueInput
              variable={v}
              value={v.defaultValue}
              onChange={(val) => edit(v.id, (vr) => { vr.defaultValue = val; })}
            />
            <button
              className="btn btn-ghost btn-icon btn-danger"
              title="Delete variable"
              onClick={() => mutate((p) => { p.variables = p.variables.filter((vr) => vr.id !== v.id); })}
            >
              x
            </button>
          </div>
        </div>
      ))}

      <p className="hint">
        Triggers compare against these by equality. Deleting a variable that a
        trigger references leaves that condition permanently false.
      </p>
      <div className="divider" />
      <h4 className="panel-subtitle">Built-in references</h4>
      <p className="hint">
        Text blocks substitute <strong>%Name%</strong> at runtime - your
        variables by name, plus built-ins: %SlideNumber%, %TotalSlides%,
        %SlideName%, %ProjectName%, %ProgressPercent%, %ViewedSlides%,
        %ScorePercent%, %Date%, %Time%, %RandomNumber%. Example:
        "Slide %SlideNumber% of %TotalSlides%".
      </p>
    </div>
  );
}
