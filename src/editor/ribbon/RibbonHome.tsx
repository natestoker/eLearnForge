import { useState } from 'react';
import { useCurrentSlide, useProjectStore } from '../../state/projectStore';
import { useUiStore } from '../../state/uiStore';
import { ColorInput, Field, SelectInput } from '../fields';
import { PlayerSettingsSection, ResourcesEditor, GlossaryEditor } from '../GlobalSettings';
import { Icon } from '../icons';
import { Modal } from '../Modal';

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
  const [activeModal, setActiveModal] = useState<'player' | 'resources' | 'glossary' | null>(null);

  return (
    <>
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Field label="Player accent">
              <span title="Colors the published course: buttons, progress bar, highlights, and quiz feedback. Not the editor.">
                <ColorInput
                  value={project.theme?.accent ?? '#3ddc97'}
                  onChange={(v) => mutate((p) => { p.theme = { accent: v, palette: p.theme?.palette }; })}
                />
              </span>
            </Field>
            <span className="rbn-note">Buttons & highlights in the published course</span>
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
            <span className="rbn-note">One-click swatches in every color picker (right-click a chip to remove)</span>
          </div>
          <Field label="Slide transition">
            <SelectInput
              value={project.slideTransition ?? 'none'}
              options={TRANSITION_OPTIONS}
              onChange={(v) => mutate((p) => { p.slideTransition = v === 'none' ? undefined : (v as 'fade'); })}
            />
          </Field>
        </div>
        <span className="ribbon-group-title">Course Theme</span>
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
            <span className="rbn-note">Right-click the stage to drop a guide anywhere</span>
          </div>
        </div>
        <span className="ribbon-group-title">Grids &amp; Guides</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <button
            className="flex flex-col items-center justify-center gap-1 p-2 bg-surface-container-highest hover:bg-surface-variant border border-outline-variant rounded transition-colors text-on-surface hover:text-primary min-w-[70px]"
            title="See the whole course as a branching map"
            onClick={() => useUiStore.getState().setStoryViewOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M4 4.5h6v4.5H4zM14 4.5h6v4.5h-6zM9 15h6v4.5H9zM7 9v3h10V9M12 12v3" /></svg>
            <span className="text-xs">Story View</span>
          </button>
        </div>
        <span className="ribbon-group-title">Course Map</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <button className="flex flex-col items-center justify-center gap-1 p-2 bg-surface-container-highest hover:bg-surface-variant border border-outline-variant rounded transition-colors text-on-surface hover:text-primary min-w-[70px]" onClick={() => setActiveModal('player')}>
            <Icon.settings />
            <span className="text-xs">Player</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 p-2 bg-surface-container-highest hover:bg-surface-variant border border-outline-variant rounded transition-colors text-on-surface hover:text-primary min-w-[70px]" onClick={() => setActiveModal('resources')}>
            <Icon.document />
            <span className="text-xs">Resources</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 p-2 bg-surface-container-highest hover:bg-surface-variant border border-outline-variant rounded transition-colors text-on-surface hover:text-primary min-w-[70px]" onClick={() => setActiveModal('glossary')}>
            <Icon.book />
            <span className="text-xs">Glossary</span>
          </button>
        </div>
        <span className="ribbon-group-title">Course Settings</span>
      </div>

      {activeModal === 'player' && (
        <Modal title="Player Settings" onClose={() => setActiveModal(null)} width="500px">
          <PlayerSettingsSection />
        </Modal>
      )}
      {activeModal === 'resources' && (
        <Modal title="Resources" onClose={() => setActiveModal(null)} width="600px">
          <ResourcesEditor />
        </Modal>
      )}
      {activeModal === 'glossary' && (
        <Modal title="Glossary" onClose={() => setActiveModal(null)} width="600px">
          <GlossaryEditor />
        </Modal>
      )}
    </>
  );
}
