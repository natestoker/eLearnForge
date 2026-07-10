import { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';
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
                  onChange={(v) => mutate((p) => { p.theme = { accent: v }; })}
                />
              </span>
            </Field>
            <span className="rbn-note">Buttons & highlights in the published course</span>
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
