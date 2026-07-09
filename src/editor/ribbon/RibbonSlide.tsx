import { useCurrentSlide, useProjectStore } from '../../state/projectStore';
import { Field, NumberInput, SelectInput, TextInput, CheckboxInput, ImagePicker } from '../fields';
import { Slide } from '../../schema/types';
import { BakeNarration } from '../BakeNarration';
import { VoiceRecorder } from '../VoiceRecorder';

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

export function RibbonSlide() {
  const slide = useCurrentSlide();
  const mutate = useProjectStore((s) => s.mutate);

  if (!slide) return null;

  return (
    <>
      <div className="ribbon-group">
        <div className="ribbon-items">
          <Field label="Name">
            <TextInput
              value={slide.name}
              onChange={(v) => mutate((p) => { const s = p.slides.find(sl => sl.id === slide.id); if (s) s.name = v; })}
            />
          </Field>
          <Field label="Width">
            <NumberInput
              value={slide.width} min={320}
              onChange={(v) => mutate((p) => { const s = p.slides.find(sl => sl.id === slide.id); if (s) s.width = v; })}
            />
          </Field>
          <Field label="Height">
            <NumberInput
              value={slide.height} min={240}
              onChange={(v) => mutate((p) => { const s = p.slides.find(sl => sl.id === slide.id); if (s) s.height = v; })}
            />
          </Field>
          <Field label="Transition">
            <SelectInput
              value={slide.transition ?? ''}
              options={[{ value: '', label: 'Course default' }, ...TRANSITION_OPTIONS]}
              onChange={(v) => mutate((p) => { const s = p.slides.find(sl => sl.id === slide.id); if (s) s.transition = v === '' ? undefined : (v as Slide['transition']); })}
            />
          </Field>
        </div>
        <span className="ribbon-group-title">Slide Settings</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          {!slide.timeline ? (
            <button className="btn" onClick={() => mutate((p) => { const s = p.slides.find(sl => sl.id === slide.id); if (s) s.timeline = { duration: 10, autoAdvance: false }; })}>
              Add Timeline
            </button>
          ) : (
            <>
              <Field label="Duration (s)">
                <NumberInput
                  value={slide.timeline.duration} min={1}
                  onChange={(v) => mutate((p) => { const s = p.slides.find(sl => sl.id === slide.id); if (s?.timeline) s.timeline.duration = Math.max(1, v); })}
                />
              </Field>
              <CheckboxInput
                label="Auto-advance"
                checked={slide.timeline.autoAdvance}
                onChange={(v) => mutate((p) => { const s = p.slides.find(sl => sl.id === slide.id); if (s?.timeline) s.timeline.autoAdvance = v; })}
              />
              <button className="btn btn-ghost btn-danger" onClick={() => mutate((p) => { const s = p.slides.find(sl => sl.id === slide.id); if (s) s.timeline = undefined; })}>
                Remove
              </button>
            </>
          )}
        </div>
        <span className="ribbon-group-title">Timeline</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <BakeNarration slideId={slide.id} />
        </div>
        <span className="ribbon-group-title">Audio</span>
      </div>
    </>
  );
}
