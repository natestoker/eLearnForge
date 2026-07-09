import { useState } from 'react';
import { useProjectStore } from '../state/projectStore';

export function SlidesPanel() {
  const slides = useProjectStore((s) => s.project.slides);
  const templates = useProjectStore((s) => s.project.templates);
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const addSlide = useProjectStore((s) => s.addSlide);
  const deleteSlide = useProjectStore((s) => s.deleteSlide);
  const saveSlideAsTemplate = useProjectStore((s) => s.saveSlideAsTemplate);
  const addSlideFromTemplate = useProjectStore((s) => s.addSlideFromTemplate);
  const deleteTemplate = useProjectStore((s) => s.deleteTemplate);
  const mutate = useProjectStore((s) => s.mutate);
  const record = useProjectStore((s) => s.record);

  const saveTemplate = (slideId: string, fallback: string) => {
    const name = window.prompt('Template name', fallback);
    if (name !== null) saveSlideAsTemplate(slideId, name.trim() || fallback);
  };

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startSlideDrag = (e: React.PointerEvent, id: string, startIdx: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const startY = e.clientY;
    let cur = startIdx;
    const ROW_H = 46; // Approximate height of a slide row
    let recorded = false;
    const onMove = (ev: PointerEvent) => {
      const target = Math.max(0, Math.min(slides.length - 1, startIdx + Math.round((ev.clientY - startY) / ROW_H)));
      if (target === cur) return;
      if (!recorded) { record(); recorded = true; }
      cur = target;
      mutate((p) => {
        const idx = p.slides.findIndex(s => s.id === id);
        if (idx === -1) return;
        const [s] = p.slides.splice(idx, 1);
        p.slides.splice(target, 0, s);
      }, false);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).tagName === 'INPUT') return;
                startSlideDrag(e, slide.id, i);
              }}
            >
              <span className="tl-grip slide-grip" title="Drag to reorder slide">
                {'\u22EE\u22EE'}
              </span>
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
              {active && (
                <div className="slide-actions" onClick={(e) => e.stopPropagation()}>
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
