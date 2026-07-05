import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Project } from '../schema/types';
import { Player } from './Player';
import { importProjectJson } from '../state/persistence';
import { createAdapter, type PublishTarget } from '../tracking';
import type { TrackingAdapter } from '../tracking/adapter';
import '../styles.css';

declare global {
  interface Window {
    FORGE_PUBLISH?: { target: PublishTarget };
  }
}

// player.html: proves the runtime runs standalone in a browser tab (brief
// requirement). Loads the project from the editor handoff key, or from a
// .elearnforge.json file picked by the user.

import { PREVIEW_KEY } from './previewKey';

// Published packages embed the project as JSON inside the HTML itself, so
// the file is fully self-contained (blob-URL and LMS friendly).
function loadEmbedded(): Project | null {
  const el = document.getElementById('forge-project');
  if (!el?.textContent?.trim()) return null;
  try {
    return JSON.parse(el.textContent) as Project;
  } catch (err) {
    console.error('eLearnForge: embedded project JSON is invalid', err);
    return null;
  }
}

function loadHandoff(): Project | null {
  try {
    const raw = localStorage.getItem(PREVIEW_KEY);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

function StandalonePlayer() {
  const [project, setProject] = useState<Project | null>(() => loadEmbedded() ?? loadHandoff());
  const [error, setError] = useState('');
  // Adapter is chosen by the publish flag baked into exported HTML only.
  // Editor handoff / file-picker playback stays adapterless so authors
  // always preview from a clean state with no resume surprises.
  const [adapter] = useState<TrackingAdapter | undefined>(() =>
    window.FORGE_PUBLISH ? createAdapter(window.FORGE_PUBLISH.target) : undefined
  );

  if (!project) {
    return (
      <div className="player-empty">
        <h1>eLearnForge Player</h1>
        <p>No project handed off from the editor. Load a project file to play it.</p>
        <label className="btn btn-accent btn-file">
          Load project JSON
          <input
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setProject(await importProjectJson(file));
                setError('');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not read that file.');
              }
            }}
          />
        </label>
        {error && <p className="player-error">{error}</p>}
      </div>
    );
  }

  return <Player project={project} adapter={adapter} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StandalonePlayer />
  </StrictMode>
);
