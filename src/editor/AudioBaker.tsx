import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  bakeSpeech, isModelLoaded, previewVoice, loadTts,
  BAKE_VOICES, type BakeResult
} from './audioBake';
import { Field, SelectInput } from './fields';

// The single speech-generation UI. Kokoro synthesizes the waveform
// in-browser (no capture step, no OS voices), the result is always an MP3
// file, and every caller - slide narration, block audio - goes through this
// one component. First use downloads the voice model (~86MB), then it is
// cached by the browser.

export function AudioBaker({ text, bakeLabel = 'Bake audio', emptyHint, onBaked, resultActions }: {
  text: string;                 // what to speak; empty disables the bake button
  bakeLabel?: string;
  emptyHint?: string;           // shown when text is empty
  onBaked?: (r: BakeResult) => void;      // e.g. attach to the block
  resultActions?: (r: BakeResult) => ReactNode; // extra buttons under the result
}) {
  const [voice, setVoice] = useState(BAKE_VOICES[0].id);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BakeResult | null>(null);
  const [message, setMessage] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(isModelLoaded());

  // Warm the model on demand (shared by preview and bake). Shows progress so
  // the ~86MB one-time download never looks like a freeze.
  const warmModel = async () => {
    if (isModelLoaded()) { setModelReady(true); return; }
    setBusy(true);
    setMessage('Downloading the voice model (one time, ~86MB). You can keep working.');
    try {
      await loadTts((p) => setProgress(Math.round(p)));
      setModelReady(true);
      setMessage('Voice model ready.');
    } catch {
      setMessage('Could not load the voice model.');
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    setPreviewing(true);
    setPreviewUrl(null);
    setProgress(0);
    setMessage(isModelLoaded() ? 'Synthesizing preview...' : 'Loading the voice model (first time only, ~86MB)...');
    try {
      const url = await previewVoice(voice, (p) => setProgress(Math.round(p)));
      setPreviewUrl(url);
      setModelReady(true);
      setMessage('Preview ready - press play.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Preview failed.');
    } finally {
      setPreviewing(false);
    }
  };

  const canBake = text.trim().length > 0;

  const bake = async () => {
    if (!canBake) return;
    setBusy(true);
    setResult(null);
    setProgress(0);
    setMessage(isModelLoaded() ? 'Synthesizing...' : 'Loading the voice model (first time only, ~86MB)...');
    try {
      const r = await bakeSpeech({
        text: text.trim(),
        voiceId: voice,
        onProgress: (p) => setProgress(Math.round(p))
      });
      setResult(r);
      setModelReady(true);
      setMessage(`Baked ${r.seconds.toFixed(1)}s of audio.`);
      onBaked?.(r);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Bake failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bake-narration">
      <Field label="Voice">
        <SelectInput
          value={voice}
          options={BAKE_VOICES.map((v) => ({ value: v.id, label: v.label }))}
          onChange={(v) => setVoice(v)}
        />
      </Field>
      <div className="field-row">
        <button className="btn" onClick={preview} disabled={previewing || busy}>
          {previewing ? 'Preparing...' : 'Preview voice'}
        </button>
        {!modelReady && (
          <button className="btn" onClick={warmModel} disabled={busy} title="Download the voice model now so later bakes are instant">
            Download voice model
          </button>
        )}
      </div>
      {previewUrl && (
        <audio src={previewUrl} controls autoPlay style={{ width: '100%', marginTop: 6 }} />
      )}
      {(busy || previewing) && (
        <div className="dl-progress" title={`${progress}%`}>
          <div className="dl-progress-fill" style={{ width: `${progress}%` }} />
          <span className="dl-progress-label">
            {modelReady
              ? (previewing ? `Synthesizing preview... ${progress}%` : `Synthesizing... ${progress}%`)
              : `Downloading voice model... ${progress}%`}
          </span>
        </div>
      )}
      <button className="btn btn-accent" onClick={bake} disabled={!canBake || busy} style={{ marginTop: 6 }}>
        {busy ? 'Baking...' : bakeLabel}
      </button>
      {!canBake && emptyHint && <p className="hint">{emptyHint}</p>}
      {result && (
        <div className="bake-result">
          <audio src={result.dataUrl} controls style={{ width: '100%' }} />
          {resultActions && (
            <div className="field-row" style={{ marginTop: 6 }}>
              {resultActions(result)}
            </div>
          )}
        </div>
      )}
      {message && <p className="hint bake-message">{message}</p>}
    </div>
  );
}
