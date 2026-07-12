import { useUiStore, RibbonTab } from '../state/uiStore';
import { Toolbar } from './Toolbar';
import { RibbonHome } from './ribbon/RibbonHome';
import { RibbonSlide } from './ribbon/RibbonSlide';
import { RibbonInsert } from './ribbon/RibbonInsert';
import { RibbonFormat } from './ribbon/RibbonFormat';
import { RibbonAnimations } from './ribbon/RibbonAnimations';
import { RibbonTriggers } from './ribbon/RibbonTriggers';
import { RibbonVariables } from './ribbon/RibbonVariables';

const TABS: { id: RibbonTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'slide', label: 'Slide' },
  { id: 'format', label: 'Format' },
  { id: 'animations', label: 'Animations' },
  { id: 'triggers', label: 'Triggers' },
  { id: 'variables', label: 'Variables' }
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
          {collapsed ? '⌄' : '⌃'}
        </button>
      </div>

      {/* Ribbon body content */}
      {!collapsed && (
        <div className="ribbon-body">
          {activeTab === 'home' && <RibbonHome />}
          {activeTab === 'slide' && <RibbonSlide />}
          {activeTab === 'insert' && <RibbonInsert />}
          {activeTab === 'format' && <RibbonFormat />}
          {activeTab === 'animations' && <RibbonAnimations />}
          {activeTab === 'triggers' && <RibbonTriggers />}
          {activeTab === 'variables' && <RibbonVariables />}
        </div>
      )}
    </div>
  );
}
