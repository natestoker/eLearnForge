import type { Project, PlayerSettings } from '../schema/types';
import type { Runtime } from '../engine/runtime';

// Player navigation lives in a collapsible LEFT sidebar (hamburger-toggled
// from the stage) instead of the bottom bar: the course menu plus
// Back/Next/Submit, out of the way until needed so the stage gets the
// vertical space. The bottom bar keeps only the timeline transport and the
// course HUD. Applies to Preview and published players only - the editor
// is untouched.
export function PlayerSideNav({ runtime, project, slideIndex, settings, onNavigate }: {
  runtime: Runtime;
  project: Project;
  slideIndex: number;
  settings: PlayerSettings;
  onNavigate?: () => void;
}) {
  const go = (dir: 1 | -1) => {
    const next = project.slides[slideIndex + dir];
    if (next) runtime.enterSlide(next.id);
  };

  return (
    <div className="player-sidenav-inner">
      <div className="player-menu-head">
        <span>Contents</span>
      </div>
      {settings.menu.show && (
        <div className="player-sidenav-list">
          {project.slides.map((s, i) => (
            <button
              key={s.id}
              className={`player-menu-item ${i === slideIndex ? 'active' : ''}`}
              disabled={settings.menu.locked ? i > slideIndex && !runtime.slideVisited(s.id) : false}
              onClick={() => { runtime.enterSlide(s.id); onNavigate?.(); }}
            >
              <span className="player-menu-num">{i + 1}</span>
              <span className="player-menu-label">{s.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="player-sidenav-buttons">
        {settings.back.show && (
          <button
            className="player-chrome-btn"
            disabled={slideIndex === 0 || !runtime.isPlayerButtonEnabled('back')}
            onClick={() => go(-1)}
          >
            {settings.back.label}
          </button>
        )}
        {settings.next.show && (
          <button
            className="player-chrome-btn accent"
            disabled={slideIndex >= project.slides.length - 1 || !runtime.isPlayerButtonEnabled('next')}
            onClick={() => go(1)}
          >
            {settings.next.label}
          </button>
        )}
        {settings.submit.show && (
          <button
            className="player-chrome-btn accent"
            disabled={!runtime.isPlayerButtonEnabled('submit')}
            onClick={() => runtime.submit()}
          >
            {settings.submit.label}
          </button>
        )}
      </div>
    </div>
  );
}
