import { useEffect, useState } from 'react';

// The authoring editor is a desktop/tablet tool (ribbon, canvas, panels,
// timeline) - it can't lay out under ~900px. This gate shows a friendly
// notice on narrow screens instead of a broken layout, but never blocks:
// "Continue anyway" dismisses it (rotating a tablet to landscape also
// passes automatically). It is mounted only in the editor - published
// courses play on any device, so the player is never gated.

const MIN_WIDTH = 900;
const DISMISS_KEY = 'elearnforge.gateDismissed';

export function DesktopGate() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < MIN_WIDTH);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < MIN_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!narrow || dismissed) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="desktop-gate" role="dialog" aria-label="Desktop recommended">
      <div className="desktop-gate-card">
        <span className="brand-mark" aria-hidden="true">eF</span>
        <h1>Best on a bigger screen</h1>
        <p>
          The eLearnForge <b>editor</b> — canvas, timeline, and panels — needs a
          desktop or tablet to lay out properly. On a phone it gets cramped fast.
        </p>
        <p className="desktop-gate-note">
          Courses you <b>publish</b> play great on any device, including phones —
          it's just the authoring tool that wants room.
        </p>
        <button className="btn btn-accent" onClick={dismiss}>Continue anyway</button>
        <div className="desktop-gate-links">
          <a href="https://www.youtube.com/@NathanStoker" target="_blank" rel="noopener noreferrer">▶ YouTube @NathanStoker</a>
          <a href="https://buymeacoffee.com/natestokerz" target="_blank" rel="noopener noreferrer">☕ Buy me a coffee</a>
        </div>
      </div>
    </div>
  );
}
