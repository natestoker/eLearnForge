import { useProjectStore } from '../../state/projectStore';

// The variable list lives in the right-hand panel (see App.tsx) - the ribbon
// strip is too short for an editable table. The shelf keeps a slim summary.
export function RibbonVariables() {
  const count = useProjectStore((s) => s.project.variables.length);

  return (
    <div className="ribbon-group">
      <div className="ribbon-items" style={{ alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>
          {count === 0 ? 'No project variables yet.' : `${count} project variable${count === 1 ? '' : 's'}.`}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          Add and edit variables in the panel on the right {'→'}
        </span>
      </div>
      <span className="ribbon-group-title">Project Variables</span>
    </div>
  );
}
