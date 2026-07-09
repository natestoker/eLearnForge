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

  return (
    <div className="ribbon">
      {/* Top bar with file actions, title, preview/publish */}
      <Toolbar saveState={saveState} />
      
      {/* Tab headers */}
      <div className="ribbon-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`ribbon-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ribbon body content */}
      <div className="ribbon-body">
        {activeTab === 'home' && <RibbonHome />}
        {activeTab === 'slide' && <RibbonSlide />}
        {activeTab === 'insert' && <RibbonInsert />}
        {activeTab === 'format' && <RibbonFormat />}
        {activeTab === 'animations' && <RibbonAnimations />}
        {activeTab === 'triggers' && <RibbonTriggers />}
        {activeTab === 'variables' && <RibbonVariables />}
      </div>
    </div>
  );
}
