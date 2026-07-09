import { useProjectStore } from '../../state/projectStore';
import { ColorInput, Field, SelectInput } from '../fields';
import { PlayerSettingsSection, ResourcesEditor, GlossaryEditor } from '../GlobalSettings';

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
      
      {/* 
        TODO STITCH:
        The following groups (Player, Resources, Glossary) contain large legacy vertical components.
        They currently take up a lot of horizontal space and disrupt the ribbon layout.
        Please redesign these into modal popups, dialog boxes, or proper horizontal ribbon menus,
        similar to advanced settings dialog launchers in PowerPoint. 
      */}
      <div className="ribbon-group">
        <div className="ribbon-items" style={{ flexDirection: 'column', alignItems: 'flex-start', overflowY: 'auto', maxHeight: '120px' }}>
          <PlayerSettingsSection />
        </div>
        <span className="ribbon-group-title">Player Settings</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items" style={{ flexDirection: 'column', alignItems: 'flex-start', overflowY: 'auto', maxHeight: '120px' }}>
           <ResourcesEditor />
        </div>
        <span className="ribbon-group-title">Resources</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items" style={{ flexDirection: 'column', alignItems: 'flex-start', overflowY: 'auto', maxHeight: '120px' }}>
           <GlossaryEditor />
        </div>
        <span className="ribbon-group-title">Glossary</span>
      </div>
    </>
  );
}
