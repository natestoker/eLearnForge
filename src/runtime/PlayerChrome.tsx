import type { NavOverride, Project, PlayerSettings } from '../schema/types';
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
  // Merge the global button setting with this slide's optional override.
  // 'hide' drops the button here, 'show' forces it visible, 'disable' shows it
  // greyed out. Absent = inherit the course-wide PlayerSettings.
  const nav = project.slides[slideIndex]?.nav;
  const shown = (which: 'next' | 'back' | 'submit') => {
    const o = nav?.[which];
    if (o === 'hide') return false;
    if (o === 'show' || o === 'disable') return true;
    return settings[which].show;
  };
  const forcedOff = (which: 'next' | 'back' | 'submit'): boolean => nav?.[which] === 'disable';
  return (
    <div className="player-navbar-buttons">
      {shown('submit') && (
        <button
          className="player-chrome-btn accent"
          disabled={forcedOff('submit') || !runtime.isPlayerButtonEnabled('submit')}
          onClick={() => runtime.submit()}
        >
          {settings.submit.label}
        </button>
      )}
      {shown('back') && (
        <button
          className="player-chrome-btn"
          disabled={forcedOff('back') || slideIndex === 0 || !runtime.isPlayerButtonEnabled('back')}
          onClick={() => go(-1)}
        >
          {settings.back.label}
        </button>
      )}
      {shown('next') && (
        <button
          className="player-chrome-btn accent"
          disabled={forcedOff('next') || slideIndex >= project.slides.length - 1 || !runtime.isPlayerButtonEnabled('next')}
          onClick={() => go(1)}
        >
          {settings.next.label}
        </button>
      )}
    </div>
  );
}

// A NavOverride select used by the Slide ribbon. Exported here so the label
// wording (Default / Show / Disable / Hide) stays in one place.
export const NAV_OVERRIDE_OPTIONS: { value: '' | NavOverride; label: string }[] = [
  { value: '', label: 'Course default' },
  { value: 'show', label: 'Show' },
  { value: 'disable', label: 'Disable (greyed)' },
  { value: 'hide', label: 'Hide' }
];
