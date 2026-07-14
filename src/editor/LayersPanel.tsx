import { useRef, useState } from 'react';
import { useCurrentSlide, useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';

export function LayersPanel() {
  const slide = useCurrentSlide();
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const addLayer = useProjectStore((s) => s.addLayer);
  const deleteLayer = useProjectStore((s) => s.deleteLayer);
  const duplicateLayer = useProjectStore((s) => s.duplicateLayer);
  const moveLayer = useProjectStore((s) => s.moveLayer);
  const mutate = useProjectStore((s) => s.mutate);
  const hiddenLayerIds = useUiStore((s) => s.hiddenLayerIds);
  const toggleLayerHidden = useUiStore((s) => s.toggleLayerHidden);
  const layersCollapsed = useUiStore((s) => s.layersCollapsed);
  const toggleLayersCollapsed = useUiStore((s) => s.toggleLayersCollapsed);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const cancelRef = useRef(false);

  // Grip drag to reorder (same gesture as the slides rail). The base layer is
  // pinned at index 0; moveLayer's own bounds keep everything else in range.
  const startLayerDrag = (e: React.PointerEvent, layerId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const grip = e.currentTarget as HTMLElement;
    grip.setPointerCapture(e.pointerId);
    const row = grip.closest('.layer-item') as HTMLElement | null;
    const ROW_H = (row?.offsetHeight ?? 26) + 3;
    const startY = e.clientY;
    let applied = 0;
    const onMove = (ev: PointerEvent) => {
      const target = Math.round((ev.clientY - startY) / ROW_H);
      while (applied < target) { moveLayer(layerId, 1); applied++; }
      while (applied > target) { moveLayer(layerId, -1); applied--; }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Collapsed: render nothing at all so the Slides panel takes the full
  // sidebar height. The restore toggle lives in the Slides panel header.
  if (layersCollapsed) return null;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Layers</span>
        <span style={{ display: 'flex', gap: 2 }}>
          <button className="btn btn-ghost btn-icon" title="Add layer" onClick={() => addLayer(slide.id)}>+</button>
          <button
            className="btn btn-ghost btn-icon"
            title="Hide the layers panel (more room for slides)"
            onClick={toggleLayersCollapsed}
          >
            {'⌃'}
          </button>
        </span>
      </div>
      {layersCollapsed ? null : (
      <div className="panel-body layers-list">
        {slide.layers.map((layer, i) => {
          const isBase = i === 0;
          const active = layer.id === selection.layerId;
          const editorHidden = !!hiddenLayerIds[layer.id];
          return (
            <div
              key={layer.id}
              className={`layer-item ${active ? 'active' : ''}`}
              onClick={() => select({ layerId: layer.id, blockId: null })}
              onDoubleClick={() => {
                // The base layer's behavior is fixed, but its name is just a
                // label - renaming it is fine and often useful ("Background").
                setRenamingId(layer.id); setDraft(layer.name);
              }}
            >
              {!isBase && (
                <span
                  className="tl-grip layer-grip"
                  title="Drag to reorder layer"
                  onPointerDown={(e) => startLayerDrag(e, layer.id)}
                >
                  {'⋮⋮'}
                </span>
              )}
              <button
                className={`btn btn-ghost btn-icon eye ${editorHidden ? 'off' : ''}`}
                title={editorHidden ? 'Show on canvas' : 'Hide on canvas (editor only)'}
                onClick={(e) => { e.stopPropagation(); toggleLayerHidden(layer.id); }}
              >
                {editorHidden ? '-' : 'o'}
              </button>
              <button
                className="btn btn-ghost btn-icon"
                style={layer.locked ? { color: 'var(--danger)' } : undefined}
                title={layer.locked ? 'Unlock this layer' : 'Lock this layer (blocks can be selected but not edited)'}
                onClick={(e) => {
                  e.stopPropagation();
                  mutate((p) => {
                    const s = p.slides.find((sl) => sl.id === slide.id);
                    const l = s?.layers.find((ly) => ly.id === layer.id);
                    if (l) l.locked = l.locked ? undefined : true;
                  });
                }}
              >
                {layer.locked ? '\u{1F512}' : '\u{1F513}'}
              </button>
              {renamingId === layer.id ? (
                <input
                  className="input input-inline"
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    if (cancelRef.current) {
                      cancelRef.current = false;
                    } else {
                      mutate((p) => {
                        const s = p.slides.find((sl) => sl.id === slide.id);
                        const l = s?.layers.find((ly) => ly.id === layer.id);
                        if (l && draft.trim()) l.name = draft.trim();
                      });
                    }
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    else if (e.key === 'Escape') {
                      cancelRef.current = true;
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              ) : (
                <span className="layer-name" title="Double-click to rename">
                  {layer.name}
                </span>
              )}
              <span className="layer-sub">{layer.blocks.length}</span>
              <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn btn-ghost btn-icon"
                  title="Rename layer"
                  onClick={() => { setRenamingId(layer.id); setDraft(layer.name); }}
                >
                  {'\u270e'}
                </button>
              </div>
              {isBase ? (
                <span className="layer-tag" title="Always visible on slide load">base</span>
              ) : (
                <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
                  <label className="checkbox tiny" title="Visible when the slide loads">
                    <input
                      type="checkbox"
                      checked={layer.visibleByDefault}
                      onChange={(e) =>
                        mutate((p) => {
                          const s = p.slides.find((sl) => sl.id === slide.id);
                          const l = s?.layers.find((ly) => ly.id === layer.id);
                          if (l) l.visibleByDefault = e.target.checked;
                        })
                      }
                    />
                    <span>default</span>
                  </label>
                  <button
                    className="btn btn-ghost btn-icon"
                    style={layer.timeline ? { color: 'var(--accent)' } : undefined}
                    title={layer.timeline
                      ? 'This layer has its own timeline (starts when the layer is shown). Click to remove it.'
                      : 'Give this layer its own timeline - it starts when the layer is shown, and the seekbar follows it'}
                    onClick={() => {
                      if (layer.timeline && !confirm('Remove this layer’s own timeline? Its blocks go back to the base timeline clock.')) return;
                      mutate((p) => {
                        const s = p.slides.find((sl) => sl.id === slide.id);
                        const l = s?.layers.find((ly) => ly.id === layer.id);
                        if (!l) return;
                        l.timeline = l.timeline ? undefined : { duration: 10, autoAdvance: false };
                        if (!l.timeline) l.pauseBase = undefined;
                      });
                      select({ layerId: layer.id, blockId: null });
                    }}
                  >
                    {'⏱'}
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    title="Duplicate this layer (and everything on it)"
                    onClick={() => duplicateLayer(slide.id, layer.id)}
                  >
                    {'⧉'}
                  </button>
                  <button
                    className="btn btn-ghost btn-icon btn-danger"
                    title="Delete layer"
                    onClick={() => deleteLayer(slide.id, layer.id)}
                  >
                    x
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
      {!layersCollapsed && <p className="panel-footnote">New blocks land on the selected layer.</p>}
    </div>
  );
}
