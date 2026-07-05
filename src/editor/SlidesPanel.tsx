import { useState } from 'react';
import { useProjectStore } from '../state/projectStore';

export function SlidesPanel() {
  const slides = useProjectStore((s) => s.project.slides);
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const addSlide = useProjectStore((s) => s.addSlide);
  const deleteSlide = useProjectStore((s) => s.deleteSlide);
  const moveSlide = useProjectStore((s) => s.moveSlide);
  const mutate = useProjectStore((s) => s.mutate);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Slides</span>
        <button className="btn btn-ghost btn-icon" title="Add slide" onClick={addSlide}>+</button>
      </div>
      <div className="panel-body slides-list">
        {slides.map((slide, i) => {
          const active = slide.id === selection.slideId;
          return (
            <div
              key={slide.id}
              className={`slide-item ${active ? 'active' : ''}`}
              onClick={() =>
                select({ slideId: slide.id, layerId: slide.layers[0].id, blockId: null })
              }
              onDoubleClick={() => { setRenamingId(slide.id); setDraft(slide.name); }}
            >
              <span className="slide-num">{i + 1}</span>
              {renamingId === slide.id ? (
                <input
                  className="input input-inline"
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    mutate((p) => {
                      const s = p.slides.find((sl) => sl.id === slide.id);
                      if (s && draft.trim()) s.name = draft.trim();
                    });
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
              ) : (
                <span className="slide-name" title="Double-click to rename">{slide.name}</span>
              )}
              <span className="slide-sub">{slide.layers.length} layer{slide.layers.length === 1 ? '' : 's'}</span>
              {active && (
                <div className="slide-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-icon" title="Move up" disabled={i === 0}
                    onClick={() => moveSlide(slide.id, -1)}>&uarr;</button>
                  <button className="btn btn-ghost btn-icon" title="Move down" disabled={i === slides.length - 1}
                    onClick={() => moveSlide(slide.id, 1)}>&darr;</button>
                  <button className="btn btn-ghost btn-icon btn-danger" title="Delete slide"
                    disabled={slides.length <= 1}
                    onClick={() => deleteSlide(slide.id)}>x</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
