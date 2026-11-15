import { useCurrentSlide, useProjectStore } from '../../state/projectStore';
import { useUiStore } from '../../state/uiStore';
import { ColorInput, Field, SelectInput } from '../fields';
import { Lucide } from '../lucide';

const TRANSITION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide (subtle)' },
  { value: 'slideLeft', label: 'Slide from right' },
  { value: 'slideRight', label: 'Slide from left' },
  { value: 'slideUp', label: 'Slide up' },
  { value: 'zoom', label: 'Zoom in' },
  { value: 'zoomOut', label: 'Zoom out' },
  { value: 'flip', label: 'Flip' },
  { value: 'pageFlip', label: 'Page flip' }
];

export function RibbonHome() {
  const mutate = useProjectStore((s) => s.mutate);
  const project = useProjectStore((s) => s.project);
  const slide = useCurrentSlide();
  const addGuide = useProjectStore((s) => s.addGuide);
  const showGrid = useUiStore((s) => s.showGrid);
  const toggleShowGrid = useUiStore((s) => s.toggleShowGrid);
  const snapEnabled = useUiStore((s) => s.snapEnabled);
  const setSnapEnabled = useUiStore((s) => s.setSnapEnabled);

  return (
    <>
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Field label="Accent">
              <span title="Colors the course (buttons, progress bar, highlights, quiz feedback) and the editor itself.">
                <ColorInput
                  value={project.theme?.accent ?? '#3ddc97'}
                  onChange={(v) => mutate((p) => { p.theme = { accent: v, palette: p.theme?.palette }; })}
                />
              </span>
            </Field>
            <span className="rbn-note">Course and editor highlights</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="field-label">Brand colors</span>
            <div className="brand-palette-editor">
              {(project.theme?.palette ?? []).map((c, i) => (
                <span key={i} className="brand-chip" style={{ background: c }} title={`${c} — right-click to remove`}
                  onContextMenu={(e) => { e.preventDefault(); mutate((p) => { if (p.theme?.palette) p.theme.palette = p.theme.palette.filter((_, j) => j !== i); }); }}>
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#3ddc97'}
                    onChange={(e) => mutate((p) => { if (p.theme?.palette) p.theme.palette[i] = e.target.value; })} />
                </span>
              ))}
              <button className="brand-chip add" title="Add a brand color"
                onClick={() => mutate((p) => { p.theme = p.theme ?? { accent: '#3ddc97' }; p.theme.palette = [...(p.theme.palette ?? []), '#5b8def']; })}>+</button>
            </div>
            <span className="rbn-note">Swatches in every color picker</span>
          </div>
        </div>
        <span className="ribbon-group-title">Course Theme</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Field label="Style">
              <SelectInput
                value={project.slideTransition ?? 'none'}
                options={TRANSITION_OPTIONS}
                onChange={(v) => mutate((p) => { p.slideTransition = v === 'none' ? undefined : (v as 'fade'); })}
              />
            </Field>
            <span className="rbn-note">Course default</span>
          </div>
        </div>
        <span className="ribbon-group-title">Transition</span>
      </div>

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
          <button className="rbn-course-btn" onClick={() => useUiStore.getState().setCourseSettings('player')}>
            <Lucide name="settings" size={18} /><span>Player</span>
          </button>
          <button className="rbn-course-btn" onClick={() => useUiStore.getState().setCourseSettings('resources')}>
            <Lucide name="file-text" size={18} /><span>Resources</span>
          </button>
          <button className="rbn-course-btn" onClick={() => useUiStore.getState().setCourseSettings('glossary')}>
            <Lucide name="book-open" size={18} /><span>Glossary</span>
          </button>
          <button className="rbn-course-btn" title="Give each learner a random selection of slides" onClick={() => useUiStore.getState().setCourseSettings('banks')}>
            <Lucide name="shuffle" size={18} /><span>Banks</span>
          </button>
        </div>
        <span className="ribbon-group-title">Course</span>
      </div>

    </>
  );
}
