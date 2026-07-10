import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { createDemoProject } from '../schema/factory';
import { resetFileHandle } from '../state/persistence';

// First-run welcome: a 60-second orientation shown once (localStorage flag),
// reopenable any time from the toolbar Help button. Also home to the
// creator links - this is a free tool, the coffee link keeps it alive.

export const WELCOME_SEEN_KEY = 'elearnforge.welcomed';

const STEPS = [
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
    title: 'Insert blocks',
    body: 'Text, shapes, media, quizzes, drag & drop, flashcards, scenarios - 25 block types on the Insert tab.'
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 15c3-6 6 1 9-2 2-2 1-5-1-4-1 .6-1 3 .5 4.5 1.4 1.4 4 1.8 6.5.5" /></svg>,
    title: 'Animate on the timeline',
    body: 'Entrances, exits, emphasis loops, and motion paths - quick picks in the ribbon, fine-tuning in the Animate tab on the right.'
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M13 3L5 13.5h5.5L11 21l8-10.5h-5.5z" /></svg>,
    title: 'Wire triggers & variables',
    body: 'Click a button, jump to a slide, show a layer, set a score. The Triggers and Variables tabs make courses interactive.'
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 5.5v13l10.5-6.5z" /></svg>,
    title: 'Preview & publish',
    body: 'Run the real player any time, then publish a SCORM package or a single web file for your LMS.'
  }
];

export function Welcome() {
  const setOpen = useUiStore((s) => s.setWelcomeOpen);
  const setProject = useProjectStore((s) => s.setProject);

  const close = () => {
    try { localStorage.setItem(WELCOME_SEEN_KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <div className="welcome-backdrop" onClick={close}>
      <div className="welcome" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Welcome to eLearnForge">
        <button className="welcome-close" onClick={close} aria-label="Close">×</button>
        <div className="welcome-head">
          <span className="brand-mark" aria-hidden="true">eF</span>
          <h1>Welcome to eLearnForge</h1>
          <p>Build interactive e-learning - slides, quizzes, branching, narration - and publish SCORM straight from your browser. Everything stays on your machine.</p>
        </div>
        <div className="welcome-steps">
          {STEPS.map((s) => (
            <div key={s.title} className="welcome-step">
              <span className="welcome-step-icon">{s.icon}</span>
              <b>{s.title}</b>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
        <div className="welcome-actions">
          <button
            className="btn"
            title="Replaces the current project with the 6-slide sample course"
            onClick={() => {
              if (confirm('Load the demo course? This replaces the current project.')) {
                resetFileHandle();
                setProject(createDemoProject());
                close();
              }
            }}
          >
            Explore the demo course
          </button>
          <button className="btn btn-accent" onClick={close}>Start building</button>
        </div>
        <div className="welcome-foot">
          <span>Made by Nathan Stoker.</span>
          <a href="https://www.youtube.com/@NathanStoker" target="_blank" rel="noopener noreferrer" title="Tutorials and updates on YouTube">
            ▶ YouTube @NathanStoker
          </a>
          <a href="https://buymeacoffee.com/natestokerz" target="_blank" rel="noopener noreferrer" title="If eLearnForge saved you money on authoring tools, keep it caffeinated">
            ☕ Buy me a coffee
          </a>
        </div>
      </div>
    </div>
  );
}
