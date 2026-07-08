import { useState } from 'react';
import { useProjectStore } from '../state/projectStore';

export function SlidesPanel() {
  const slides = useProjectStore((s) => s.project.slides);
  const templates = useProjectStore((s) => s.project.templates);
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const addSlide = useProjectStore((s) => s.addSlide);
  const deleteSlide = useProjectStore((s) => s.deleteSlide);
  const moveSlide = useProjectStore((s) => s.moveSlide);
  const saveSlideAsTemplate = useProjectStore((s) => s.saveSlideAsTemplate);
  const addSlideFromTemplate = useProjectStore((s) => s.addSlideFromTemplate);
  const deleteTemplate = useProjectStore((s) => s.deleteTemplate);
  const mutate = useProjectStore((s) => s.mutate);

  const saveTemplate = (slideId: string, fallback: string) => {
    const name = window.prompt('Template name', fallback);
    if (name !== null) saveSlideAsTemplate(slideId, name.trim() || fallback);
  };

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
                  <button className="btn btn-ghost btn-icon" title="Save this slide as a reusable template"
                    onClick={() => saveTemplate(slide.id, slide.name)}>&#9634;</button>
                  <button className="btn btn-ghost btn-icon btn-danger" title="Delete slide"
                    disabled={slides.length <= 1}
                    onClick={() => deleteSlide(slide.id)}>x</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {templates && templates.length > 0 && (
        <div className="templates-section">
          <div className="templates-header">Templates</div>
          {templates.map((t) => (
            <div key={t.id} className="template-item">
              <button
                className="template-insert"
                title="Add a new slide from this template"
                onClick={() => addSlideFromTemplate(t.id)}
              >
                &#43; {t.name}
              </button>
              <button className="btn btn-ghost btn-icon btn-danger" title="Delete template" onClick={() => deleteTemplate(t.id)}>x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
