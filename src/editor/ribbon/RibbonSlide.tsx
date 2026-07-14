import { useState } from 'react';
import { useCurrentSlide, useProjectStore } from '../../state/projectStore';
import { Field, NumberInput, SelectInput, TextInput, CheckboxInput, ImagePicker, ColorInput } from '../fields';
import { Slide, NavOverride, SlideBackground } from '../../schema/types';
import { NAV_OVERRIDE_OPTIONS } from '../../runtime/PlayerChrome';
import { BakeNarration } from '../BakeNarration';
import { VoiceRecorder } from '../VoiceRecorder';
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

export function RibbonSlide() {
  const slide = useCurrentSlide();
  const mutate = useProjectStore((s) => s.mutate);
  const [audioOpen, setAudioOpen] = useState(false);

  if (!slide) return null;

  const hasCaptions = Boolean(slide.timeline?.captionsVtt);
  const bg = slide.background;
  const patchBg = (patch: Partial<SlideBackground>) =>
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      if (s) s.background = { ...(s.background ?? { type: 'color' }), ...patch } as SlideBackground;
    });
  const setBgType = (t: string) =>
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      if (!s) return;
      if (t === '') { s.background = undefined; return; }
      const prev = s.background;
      if (t === 'color') s.background = { type: 'color', color: prev?.color ?? '#0b1f17' };
      else if (t === 'gradient') s.background = { type: 'gradient', from: prev?.from ?? '#123b2b', to: prev?.to ?? '#0b1210', angle: prev?.angle ?? 135 };
      else s.background = { type: 'image', src: prev?.src ?? '', fit: prev?.fit ?? 'cover' };
    });
  const setNav = (which: 'next' | 'back' | 'submit', v: string) =>
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      if (!s) return;
      const nav = { ...(s.nav ?? {}) };
      if (v === '') delete nav[which];
      else nav[which] = v as NavOverride;
      s.nav = Object.keys(nav).length ? nav : undefined;
    });

  return (
    <>
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div className="rbn-fgrid">
            <Field label="Name">
              <TextInput
                value={slide.name}
                onChange={(v) => mutate((p) => { const s = p.slides.find(sl => sl.id === slide.id); if (s) s.name = v; })}
              />
            </Field>
            <Field label="Transition">
              <SelectInput
                value={slide.transition ?? ''}
                options={[{ value: '', label: 'Course default' }, ...TRANSITION_OPTIONS]}
                onChange={(v) => mutate((p) => { const s = p.slides.find(sl => sl.id === slide.id); if (s) s.transition = v === '' ? undefined : (v as Slide['transition']); })}
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
          </div>
        </div>
        <span className="ribbon-group-title">Slide Settings</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div className="rbn-fgrid">
            <Field label="Background">
              <SelectInput
                value={bg?.type ?? ''}
                options={[
                  { value: '', label: 'None (theme)' },
                  { value: 'color', label: 'Color' },
                  { value: 'gradient', label: 'Gradient' },
                  { value: 'image', label: 'Image' }
                ]}
                onChange={setBgType}
              />
            </Field>
            {bg?.type === 'color' && (
              <Field label="Fill"><ColorInput value={bg.color ?? ''} onChange={(v) => patchBg({ color: v })} /></Field>
            )}
            {bg?.type === 'gradient' && (
              <>
                <Field label="From"><ColorInput value={bg.from ?? ''} onChange={(v) => patchBg({ from: v })} /></Field>
                <Field label="To"><ColorInput value={bg.to ?? ''} onChange={(v) => patchBg({ to: v })} /></Field>
                <Field label="Angle"><NumberInput value={bg.angle ?? 135} step={15} onChange={(v) => patchBg({ angle: v })} /></Field>
              </>
            )}
            {bg?.type === 'image' && (
              <Field label="Fit">
                <SelectInput
                  value={bg.fit ?? 'cover'}
                  options={[{ value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Contain' }, { value: 'tile', label: 'Tile' }]}
                  onChange={(v) => patchBg({ fit: v as SlideBackground['fit'] })}
                />
              </Field>
            )}
          </div>
          {bg?.type === 'image' && (
            <ImagePicker src={bg.src ?? ''} onChange={(src) => patchBg({ src })} />
          )}
        </div>
        <span className="ribbon-group-title">Background</span>
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
              <span className={`cc-badge ${hasCaptions ? 'on' : 'off'}`} title={hasCaptions ? 'This slide has closed captions - they play over the stage and the CC button shows in the player.' : 'No captions yet. Bake narration from notes (Audio) to auto-generate them, or paste WebVTT.'}>
                <b>CC</b> {hasCaptions ? 'on this slide' : 'none yet'}
              </span>
            </>
          )}
        </div>
        <span className="ribbon-group-title">Timeline</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div className="rbn-fgrid">
            <Field label="Next button">
              <SelectInput value={slide.nav?.next ?? ''} options={NAV_OVERRIDE_OPTIONS} onChange={(v) => setNav('next', v)} />
            </Field>
            <Field label="Back button">
              <SelectInput value={slide.nav?.back ?? ''} options={NAV_OVERRIDE_OPTIONS} onChange={(v) => setNav('back', v)} />
            </Field>
            <Field label="Submit button">
              <SelectInput value={slide.nav?.submit ?? ''} options={NAV_OVERRIDE_OPTIONS} onChange={(v) => setNav('submit', v)} />
            </Field>
          </div>
        </div>
        <span className="ribbon-group-title">Nav (this slide)</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
            <button
              className="flex flex-col items-center justify-center gap-1 p-2 bg-surface-container-highest hover:bg-surface-variant border border-outline-variant rounded transition-colors text-on-surface hover:text-primary min-w-[76px]"
              title="Bake speaker notes into narration, or record your own - the voice model and controls open in a dialog"
              onClick={() => setAudioOpen(true)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              <span className="text-xs">Narration</span>
            </button>
            {slide.timeline?.narrationSrc && <span className="hint" style={{ fontSize: 10 }}>Narration set</span>}
          </div>
        </div>
        <span className="ribbon-group-title">Audio</span>
      </div>

      {audioOpen && (
        <Modal title={`Narration - ${slide.name}`} onClose={() => setAudioOpen(false)} width="min(860px, 92vw)">
          <BakeNarration slideId={slide.id} />
          <div className="divider" />
          <h4 className="panel-subtitle">Record your own</h4>
          <VoiceRecorder
            onRecorded={(dataUrl) =>
              mutate((p) => {
                const s = p.slides.find((sl) => sl.id === slide.id);
                if (!s) return;
                if (!s.timeline) s.timeline = { duration: 10, autoAdvance: false };
                s.timeline.narrationSrc = dataUrl;
              })
            }
          />
        </Modal>
      )}
    </>
  );
}
