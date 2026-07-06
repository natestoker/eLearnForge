import { useRef, useState } from 'react';
import type { Project, PlayerSettings } from '../schema/types';
import type { Runtime } from '../engine/runtime';

// Configurable player chrome, modeled on the PPTX Narrator player:
// Back / Next / Submit with author labels, show flags, and trigger-gated
// enabling; a Menu drawer listing slides.
export function PlayerChrome({ runtime, project, slideIndex, settings }: {
  runtime: Runtime;
  project: Project;
  slideIndex: number;
  settings: PlayerSettings;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const go = (dir: 1 | -1) => {
    const next = project.slides[slideIndex + dir];
    if (next) runtime.enterSlide(next.id);
  };

  return (
    <>
      {menuOpen && (
        <>
          <div className="player-menu-scrim" onClick={() => setMenuOpen(false)} />
          <div className="player-menu-drawer" ref={menuRef}>
            <div className="player-menu-head">
              <span>Contents</span>
              <button className="player-menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">x</button>
            </div>
            {project.slides.map((s, i) => (
              <button
                key={s.id}
                className={`player-menu-item ${i === slideIndex ? 'active' : ''}`}
                disabled={settings.menu.locked ? i > slideIndex && !runtime.slideVisited(s.id) : false}
                onClick={() => { runtime.enterSlide(s.id); setMenuOpen(false); }}
              >
                <span className="player-menu-num">{i + 1}</span>
                <span className="player-menu-label">{s.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="player-navbar">
        {settings.menu.show && (
          <button
            className="player-chrome-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            Menu
          </button>
        )}

        <span className="player-navbar-spacer" />

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
    </>
  );
}
