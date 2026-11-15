import { useCurrentSlide, useProjectStore } from '../../state/projectStore';
import { useUiStore } from '../../state/uiStore';
import { Lucide } from '../lucide';

export function RibbonView() {
  const mutate = useProjectStore((s) => s.mutate);
  const slide = useCurrentSlide();
  const addGuide = useProjectStore((s) => s.addGuide);
  const showGrid = useUiStore((s) => s.showGrid);
  const toggleShowGrid = useUiStore((s) => s.toggleShowGrid);
  const snapEnabled = useUiStore((s) => s.snapEnabled);
  const setSnapEnabled = useUiStore((s) => s.setSnapEnabled);

  return (
    <>
      <div className="ribbon-group">
        <div className="ribbon-items" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="checkbox tiny" title="Draw the 8px layout grid on the slide">
              <input type="checkbox" checked={showGrid} onChange={toggleShowGrid} />
              <span>Show grid</span>
            </label>
            <label className="checkbox tiny" title="Blocks snap to the 8px grid while dragging (hold Alt to invert)">
              <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} />
              <span>Snap to grid</span>
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="btn" style={{ fontSize: 11 }} title="Drop a vertical guide at the slide center (drag it after)"
              onClick={() => addGuide('v', Math.round(slide.width / 2))}>+ V guide</button>
            <button className="btn" style={{ fontSize: 11 }} title="Drop a horizontal guide at the slide center (drag it after)"
              onClick={() => addGuide('h', Math.round(slide.height / 2))}>+ H guide</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="btn" style={{ fontSize: 11 }} disabled={!slide.guides?.length}
              title="Remove every guide on this slide"
              onClick={() => mutate((p) => { const sl = p.slides.find((x) => x.id === slide.id); if (sl) sl.guides = undefined; })}>
              Clear guides
            </button>
            <span className="rbn-note">Right-click the stage</span>
          </div>
        </div>
        <span className="ribbon-group-title">Canvas</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <button className="rbn-course-btn" title="See the whole course as a branching map" onClick={() => useUiStore.getState().setStoryViewOpen(true)}>
            <Lucide name="git-fork" size={18} /><span>Story View</span>
          </button>
        </div>
        <span className="ribbon-group-title">Overview</span>
      </div>

    </>
  );
}
