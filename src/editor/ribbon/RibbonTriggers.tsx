import { TriggersPanel } from '../TriggersPanel';

export function RibbonTriggers() {
  return (
    <div className="ribbon-group" style={{ flex: 1, overflowX: 'auto' }}>
      <div className="ribbon-items" style={{ alignItems: 'flex-start' }}>
        <TriggersPanel />
      </div>
    </div>
  );
}
