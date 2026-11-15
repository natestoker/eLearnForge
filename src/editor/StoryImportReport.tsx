import { useUiStore } from '../state/uiStore';
import { Modal } from './Modal';

// Shown once after a Storyline file opens: what came across, and the list of
// things that could not be converted, grouped by slide.
export function StoryImportReport() {
  const report = useUiStore((s) => s.storyImportReport);
  const close = () => useUiStore.getState().setStoryImportReport(null);
  if (!report) return null;
  const bySlide = new Map<string, string[]>();
  for (const w of report.warnings) {
    const i = w.indexOf(': ');
    const slide = i > 0 ? w.slice(0, i) : 'Course';
    bySlide.set(slide, [...(bySlide.get(slide) ?? []), i > 0 ? w.slice(i + 2) : w]);
  }
  return (
    <Modal title={`Opened ${report.fileName}`} onClose={close} width="min(680px, 92vw)">
      <div className="story-report">
        <p className="story-report-lead">
          {report.slides} {report.slides === 1 ? 'slide' : 'slides'} imported.{' '}
          {report.warnings.length === 0
            ? 'Everything in the file had an equivalent.'
            : `${report.warnings.length} ${report.warnings.length === 1 ? 'thing needs' : 'things need'} a look. Triggers that could not be converted are kept as JavaScript triggers that say what the original did.`}
        </p>
        {bySlide.size > 0 && (
          <div className="story-report-list">
            {[...bySlide].map(([slide, notes]) => (
              <section key={slide}>
                <h3>{slide}</h3>
                <ul>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </section>
            ))}
          </div>
        )}
        <div className="story-report-foot">
          <button className="btn" onClick={() => { void navigator.clipboard?.writeText(report.warnings.join('\n')); }}>Copy list</button>
          <button className="btn btn-accent" onClick={close}>Done</button>
        </div>
      </div>
    </Modal>
  );
}
