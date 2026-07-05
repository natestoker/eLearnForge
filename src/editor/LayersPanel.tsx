import { useRef, useState } from 'react';
import { useCurrentSlide, useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';

export function LayersPanel() {
  const slide = useCurrentSlide();
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const addLayer = useProjectStore((s) => s.addLayer);
  const deleteLayer = useProjectStore((s) => s.deleteLayer);
  const moveLayer = useProjectStore((s) => s.moveLayer);
  const mutate = useProjectStore((s) => s.mutate);
  const hiddenLayerIds = useUiStore((s) => s.hiddenLayerIds);
  const toggleLayerHidden = useUiStore((s) => s.toggleLayerHidden);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const cancelRef = useRef(false);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Layers</span>
        <button className="btn btn-ghost btn-icon" title="Add layer" onClick={() => addLayer(slide.id)}>+</button>
      </div>
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
              <button
                className={`btn btn-ghost btn-icon eye ${editorHidden ? 'off' : ''}`}
                title={editorHidden ? 'Show on canvas' : 'Hide on canvas (editor only)'}
                onClick={(e) => { e.stopPropagation(); toggleLayerHidden(layer.id); }}
              >
                {editorHidden ? '-' : 'o'}
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
                    title="Move layer up (paints above)"
                    onClick={() => moveLayer(layer.id, 1)}
                  >
                    {'\u2191'}
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    title="Move layer down"
                    onClick={() => moveLayer(layer.id, -1)}
                  >
                    {'\u2193'}
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
      <p className="panel-footnote">New blocks land on the selected layer.</p>
    </div>
  );
}
