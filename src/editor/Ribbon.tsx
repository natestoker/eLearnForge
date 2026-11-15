import { useEffect, useRef, useState } from 'react';
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); }, [activeTab]);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Natural width of the groups vs the room there is (ignoring the More
    // button's own reserve, so the answer doesn't flip-flop).
    const measure = () => {
      const need = Array.from(el.children).reduce((w, c) => w + (c as HTMLElement).offsetWidth, 0) + 24;
      setOverflow(need > (el.parentElement?.clientWidth ?? el.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el.parentElement ?? el);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [activeTab, collapsed]);

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

      {/* Ribbon body content. When the window is too narrow for a tab, the
          groups that don't fit are cut off and a More button drops the whole
          shelf open over the canvas, wrapped onto extra rows. */}
      {!collapsed && (
        <div className="ribbon-shelf">
          <div ref={bodyRef} className={`ribbon-body${overflow ? ' has-more' : ''}${overflow && moreOpen ? ' more-open' : ''}`}>
            {activeTab === 'insert' && <RibbonInsert />}
            {activeTab === 'arrange' && <RibbonFormat />}
            {activeTab === 'animate' && <RibbonAnimations />}
            {activeTab === 'view' && <RibbonView />}
          </div>
          {overflow && (
            <button className="ribbon-more" aria-expanded={moreOpen} title="Show the commands that don't fit" onClick={() => setMoreOpen((v) => !v)}>
              <Lucide name={moreOpen ? 'chevron-up' : 'chevron-down'} size={14} /> More
            </button>
          )}
        </div>
      )}
    </div>
  );
}
