import type { Project, PlayerSettings } from '../schema/types';
import type { Runtime } from '../engine/runtime';

// Player chrome, split in two:
// - PlayerSideNav: the hamburger-toggled left drawer holding ONLY the
//   course menu (contents), out of the way until needed.
// - PlayerNavButtons: Back / Next / Submit, which live in the bottom bar
//   (settings.navPosition picks the left or right end of it).
// Applies to Preview and published players only - the editor is untouched.

export function PlayerSideNav({ runtime, project, slideIndex, settings, onNavigate }: {
  runtime: Runtime;
  project: Project;
  slideIndex: number;
  settings: PlayerSettings;
  onNavigate?: () => void;
}) {
  return (
    <div className="player-sidenav-inner">
      <div className="player-menu-head">
        <span>Contents</span>
      </div>
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
    </div>
  );
}

export function PlayerNavButtons({ runtime, project, slideIndex, settings }: {
  runtime: Runtime;
  project: Project;
  slideIndex: number;
  settings: PlayerSettings;
}) {
  const go = (dir: 1 | -1) => {
    const next = project.slides[slideIndex + dir];
    if (next) runtime.enterSlide(next.id);
  };
  return (
    <div className="player-navbar-buttons">
      {settings.submit.show && (
        <button
          className="player-chrome-btn accent"
          disabled={!runtime.isPlayerButtonEnabled('submit')}
          onClick={() => runtime.submit()}
        >
          {settings.submit.label}
        </button>
      )}
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
    </div>
  );
}
