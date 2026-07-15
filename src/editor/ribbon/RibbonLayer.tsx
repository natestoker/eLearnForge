import { useState } from 'react';
import { useCurrentSlide, useProjectStore } from '../../state/projectStore';
import { useUiStore } from '../../state/uiStore';
import { Field, NumberInput, TextInput, CheckboxInput } from '../fields';
import { BakeNarration } from '../BakeNarration';
import { Modal } from '../Modal';

// Per-layer options, mirroring the Slide ribbon but scoped to the selected
// layer: name, own timeline, visibility defaults, isolate-on-canvas, narration,
// duplicate/delete.
export function RibbonLayer() {
  const slide = useCurrentSlide();
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const mutate = useProjectStore((s) => s.mutate);
  const duplicateLayer = useProjectStore((s) => s.duplicateLayer);
  const deleteLayer = useProjectStore((s) => s.deleteLayer);
  const addLayer = useProjectStore((s) => s.addLayer);
  const hiddenLayerIds = useUiStore((s) => s.hiddenLayerIds);
  const toggleLayerHidden = useUiStore((s) => s.toggleLayerHidden);
  const soloLayer = useUiStore((s) => s.soloLayer);
  const showAllLayers = useUiStore((s) => s.showAllLayers);
  const [audioOpen, setAudioOpen] = useState(false);

  if (!slide) return null;
  const idx = slide.layers.findIndex((l) => l.id === selection.layerId);
  const layer = slide.layers[idx] ?? slide.layers[0];
  const isBase = idx <= 0;
  const allIds = slide.layers.map((l) => l.id);
  const soloed = Object.values(hiddenLayerIds).some(Boolean) && !hiddenLayerIds[layer.id]
    && slide.layers.filter((l) => l.id !== layer.id).every((l) => hiddenLayerIds[l.id]);
  const editLayer = (fn: (l: NonNullable<typeof layer>) => void) =>
    mutate((p) => {
      const l = p.slides.find((s) => s.id === slide.id)?.layers.find((x) => x.id === layer.id);
      if (l) fn(l);
    });

  return (
    <>
      {/* Layer settings */}
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div className="rbn-fgrid">
            <Field label="Layer">
              <TextInput value={layer.name} onChange={(v) => editLayer((l) => { l.name = v || l.name; })} />
            </Field>
            {!isBase && (
              <Field label="Shown on load">
                <CheckboxInput label="" checked={layer.visibleByDefault} onChange={(v) => editLayer((l) => { l.visibleByDefault = v; })} />
              </Field>
            )}
            <Field label="Locked">
              <CheckboxInput label="" checked={!!layer.locked} onChange={(v) => editLayer((l) => { l.locked = v || undefined; })} />
            </Field>
          </div>
        </div>
        <span className="ribbon-group-title">{isBase ? 'Base Layer' : 'Layer'}</span>
      </div>

      {/* Own timeline */}
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {isBase ? (
              <span className="hint" style={{ maxWidth: 160 }}>The base layer runs on the slide timeline (Slide tab).</span>
            ) : (
              <>
                <CheckboxInput
                  label="Own timeline"
                  checked={!!layer.timeline}
                  onChange={(v) => editLayer((l) => { l.timeline = v ? { duration: 10, autoAdvance: false } : undefined; if (!v) l.pauseBase = undefined; })}
                />
                {layer.timeline && (
                  <>
                    <Field label="Length (s)">
                      <NumberInput value={layer.timeline.duration} min={1} step={0.5}
                        onChange={(v) => editLayer((l) => { if (l.timeline) l.timeline.duration = Math.max(1, v); })} />
                    </Field>
                    <CheckboxInput label="Pause base while shown" checked={!!layer.pauseBase} onChange={(v) => editLayer((l) => { l.pauseBase = v || undefined; })} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <span className="ribbon-group-title">Timeline</span>
      </div>

      {/* Canvas view: isolate so layers stop occluding each other */}
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className={`btn ${soloed ? 'btn-accent' : ''}`} title="Show only this layer on the canvas (others hidden while you work)"
              onClick={() => (soloed ? showAllLayers() : soloLayer(layer.id, allIds))}>
              {soloed ? 'Show all layers' : 'Isolate this layer'}
            </button>
            <CheckboxInput label="Hide on canvas" checked={!!hiddenLayerIds[layer.id]} onChange={() => toggleLayerHidden(layer.id)} />
          </div>
        </div>
        <span className="ribbon-group-title">Canvas View</span>
      </div>

      {/* Narration */}
      <div className="ribbon-group">
        <div className="ribbon-items">
          <button
            className="flex flex-col items-center justify-center gap-1 p-2 bg-surface-container-highest hover:bg-surface-variant border border-outline-variant rounded transition-colors text-on-surface hover:text-primary min-w-[76px]"
            title={isBase ? 'Narration for the slide (base layer)' : 'Narration for this layer (separate from the slide)'}
            onClick={() => setAudioOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            <span className="text-xs">Narration</span>
          </button>
        </div>
        <span className="ribbon-group-title">Audio</span>
      </div>

      {/* Manage */}
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className="btn" onClick={() => addLayer(slide.id)}>+ New layer</button>
            <button className="btn" onClick={() => duplicateLayer(slide.id, layer.id)}>Duplicate</button>
            {!isBase && (
              <button className="btn btn-ghost btn-danger" onClick={() => { deleteLayer(slide.id, layer.id); select({ blockId: null }); }}>Delete layer</button>
            )}
          </div>
        </div>
        <span className="ribbon-group-title">Manage</span>
      </div>

      {audioOpen && (
        <Modal title={`Narration - ${layer.name}`} onClose={() => setAudioOpen(false)} width="min(860px, 92vw)">
          <BakeNarration slideId={slide.id} />
        </Modal>
      )}
    </>
  );
}
