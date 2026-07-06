import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Project, PlayerSettings } from '../schema/types';
import type { Runtime } from '../engine/runtime';
import type { TimelineClock } from './TimelineClock';
import { sortedVoices, niceVoiceName } from '../shared/voices';

// Configurable player chrome, modeled on the PPTX Narrator player:
// Back / Next / Submit with author labels, show flags, and trigger-gated
// enabling; a Menu drawer listing slides; learner-facing voice and rate
// controls when a slide narrates with TTS (voice list filtered to
// English and sorted Neural > Google > Microsoft, names cleaned - the
// exact treatment from the Narrator).

const VOICE_KEY = 'elearnforge.player.voice';
const RATE_KEY = 'elearnforge.player.rate';

export function PlayerChrome({ runtime, project, slideIndex, settings, clock, usingTts }: {
  runtime: Runtime;
  project: Project;
  slideIndex: number;
  settings: PlayerSettings;
  clock: MutableRefObject<TimelineClock | null>;
  usingTts: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState(() => localStorage.getItem(VOICE_KEY) ?? '');
  const [rate, setRate] = useState(() => Number(localStorage.getItem(RATE_KEY)) || 1);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!usingTts || !settings.voiceControls) return;
    const load = () => setVoices(sortedVoices());
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, [usingTts, settings.voiceControls]);

  // Push learner voice/rate into the live clock whenever they change.
  useEffect(() => {
    clock.current?.setTtsPrefs(voice || undefined, rate);
  }, [voice, rate, clock, slideIndex]);

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

        {usingTts && settings.voiceControls && voices.length > 0 && (
          <span className="player-voice">
            <select
              className="player-voice-select"
              value={voice}
              onChange={(e) => { setVoice(e.target.value); localStorage.setItem(VOICE_KEY, e.target.value); }}
              aria-label="Narration voice"
            >
              <option value="">Default voice</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>{niceVoiceName(v)}</option>
              ))}
            </select>
            <label className="player-rate">
              rate
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={rate}
                onChange={(e) => { const r = Number(e.target.value); setRate(r); localStorage.setItem(RATE_KEY, String(r)); }}
              />
              <span>{rate.toFixed(2)}</span>
            </label>
          </span>
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
