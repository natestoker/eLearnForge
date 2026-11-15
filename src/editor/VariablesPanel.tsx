import type { Variable } from '../schema/types';
import { useProjectStore, walkBlocks } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { Lucide } from './lucide';
import { uid } from '../schema/factory';
import { SelectInput } from './fields';
import { ValueInput } from './TriggersPanel';
import { variableOwner } from '../shared/variableLabel';
import { blockDisplayName } from '../shared/blockName';

export function VariablesPanel() {
  const variables = useProjectStore((s) => s.project.variables);
  const project = useProjectStore((s) => s.project);
  const mutate = useProjectStore((s) => s.mutate);

  const withOwner = variables.map((v) => ({ v, owner: variableOwner(project, v) }));
  const mine = withOwner.filter((x) => !x.owner).map((x) => x.v);
  const owned = withOwner.filter((x): x is { v: Variable; owner: NonNullable<ReturnType<typeof variableOwner>> } => !!x.owner);

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
          <Lucide name="plus" size={14} /> Variable
        </button>
      </div>

      {variables.length === 0 && (
        <p className="empty-note">
          No variables yet. Multiple choice blocks create theirs automatically on insert.
        </p>
      )}

      {mine.length > 0 && <h4 className="panel-subtitle">Yours · {mine.length}</h4>}
      {mine.map((v) => (
        <div key={v.id} className="variable-card">
          <input
            className="input"
            type="text"
            aria-label="Variable name"
            value={v.name}
            onChange={(e) => edit(v.id, (vr) => { vr.name = e.target.value; })}
          />
          <div className="trigger-row">
            <SelectInput
              ariaLabel="Type"
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
              title="Delete variable (you can undo)"
              aria-label={`Delete ${v.name}`}
              onClick={() => {
                mutate((p) => { p.variables = p.variables.filter((vr) => vr.id !== v.id); });
                useUiStore.getState().setToast({ message: `Variable "${v.name}" deleted`, action: { label: 'Undo', run: () => useProjectStore.getState().undo() } });
              }}
            >
              <Lucide name="trash-2" size={14} />
            </button>
          </div>
        </div>
      ))}

      {owned.length > 0 && <h4 className="panel-subtitle">Set by blocks · {owned.length}</h4>}
      {owned.map(({ v, owner }) => (
        <button
          key={v.id}
          type="button"
          className="variable-card var-owned"
          title="Select the block that sets this"
          onClick={() => {
            const sl = project.slides.find((s) => s.layers.some((l) => walkBlocks(l.blocks).some((b) => b.id === owner.block.id)));
            const layer = sl?.layers.find((l) => walkBlocks(l.blocks).some((b) => b.id === owner.block.id));
            if (sl && layer) { useProjectStore.getState().select({ slideId: sl.id, layerId: layer.id, blockId: owner.block.id, blockIds: [] }); useUiStore.getState().setRightTab('inspect'); }
          }}
        >
          <span className="var-owned-main"><b>{blockDisplayName(owner.block)} · {owner.what}</b><Lucide name="lock" size={12} /></span>
          <code>{v.name}</code>
          <span className="var-owned-type">{v.type} · starts {String(v.defaultValue)}</span>
        </button>
      ))}
      {owned.length > 0 && <p className="hint">Block variables are read-only here and go when their block goes. Click one to select its block.</p>}

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
