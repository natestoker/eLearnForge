import { useProjectStore } from '../../state/projectStore';
import { ColorInput, Field, SelectInput } from '../fields';

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
      
      {/* We can add Player Settings, Resources, and Glossary buttons here that open modals. 
          Ribbons usually don't have massive scrolling lists inside them.
          For now, just a placeholder or simple settings. */}
      <div className="ribbon-group">
        <div className="ribbon-items">
           <button className="btn" onClick={() => alert('Player settings modal coming soon')}>Player Settings</button>
           <button className="btn" onClick={() => alert('Resources modal coming soon')}>Resources</button>
           <button className="btn" onClick={() => alert('Glossary modal coming soon')}>Glossary</button>
        </div>
        <span className="ribbon-group-title">Global Settings</span>
      </div>
    </>
  );
}
