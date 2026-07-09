import { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';
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
          <Field label="Accent color">
            <ColorInput
              value={project.theme?.accent ?? '#3ddc97'}
              onChange={(v) => mutate((p) => { p.theme = { accent: v }; })}
            />
          </Field>
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
          <button className="ribbon-btn" onClick={() => setActiveModal('player')}>
            <Icon.settings />
            <span>Player</span>
          </button>
          <button className="ribbon-btn" onClick={() => setActiveModal('resources')}>
            <Icon.document />
            <span>Resources</span>
          </button>
          <button className="ribbon-btn" onClick={() => setActiveModal('glossary')}>
            <Icon.book />
            <span>Glossary</span>
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
