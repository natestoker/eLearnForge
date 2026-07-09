import { VariablesPanel } from '../VariablesPanel';

export function RibbonVariables() {
  return (
    <div className="ribbon-group" style={{ flex: 1, overflowX: 'auto' }}>
      <div className="ribbon-items" style={{ alignItems: 'flex-start' }}>
        <VariablesPanel />
      </div>
    </div>
  );
}
