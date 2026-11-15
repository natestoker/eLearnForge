import { useUiStore, RibbonTab } from '../state/uiStore';
import { Toolbar } from './Toolbar';
import { Lucide } from './lucide';
import { RibbonInsert } from './ribbon/RibbonInsert';
import { RibbonFormat } from './ribbon/RibbonFormat';
import { RibbonAnimations } from './ribbon/RibbonAnimations';
import { RibbonView } from './ribbon/RibbonView';

const TABS: { id: RibbonTab; label: string }[] = [
  { id: 'insert', label: 'Insert' },
  { id: 'arrange', label: 'Arrange' },
  { id: 'animate', label: 'Animate' },
  { id: 'view', label: 'View' }
];

export function Ribbon({ saveState }: { saveState: 'saved' | 'saving' }) {
  const activeTab = useUiStore((s) => s.ribbonTab);
  const setTab = useUiStore((s) => s.setRibbonTab);
  const collapsed = useUiStore((s) => s.ribbonCollapsed);
  const toggleCollapsed = useUiStore((s) => s.toggleRibbonCollapsed);

  return (
    <div className="ribbon">
      {/* Top bar with file actions, title, preview/publish */}
      <Toolbar saveState={saveState} />

      {/* Tab headers; clicking a tab while collapsed re-expands the shelf */}
      <div className="ribbon-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`ribbon-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setTab(tab.id);
              if (collapsed) toggleCollapsed();
            }}
          >
            {tab.label}
          </button>
        ))}
        <button
          className="ribbon-collapse-btn"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand the ribbon' : 'Collapse the ribbon (tabs stay)'}
          aria-expanded={!collapsed}
        >
          <Lucide name={collapsed ? 'chevron-down' : 'chevron-up'} size={15} />
        </button>
      </div>

      {/* Ribbon body content */}
      {!collapsed && (
        <div className="ribbon-body">
          {activeTab === 'insert' && <RibbonInsert />}
          {activeTab === 'arrange' && <RibbonFormat />}
          {activeTab === 'animate' && <RibbonAnimations />}
          {activeTab === 'view' && <RibbonView />}
        </div>
      )}
    </div>
  );
}
