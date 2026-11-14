import { useProjectStore } from '../../state/projectStore';
import { RibbonEmpty } from './RibbonEmpty';

// The variable list lives in the right-hand panel (see App.tsx) - the ribbon
// strip is too short for an editable table. The shelf keeps a slim summary.
export function RibbonVariables() {
  const count = useProjectStore((s) => s.project.variables.length);
  return (
    <RibbonEmpty title={count === 0 ? 'No project variables yet' : `${count} project variable${count === 1 ? '' : 's'}`}>
      Add and edit variables in the panel on the right {'→'}
    </RibbonEmpty>
  );
}
