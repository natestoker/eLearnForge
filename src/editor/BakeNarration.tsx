import { useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import { createBlock } from '../schema/factory';
import type { AudioProps } from '../schema/types';
import {
  bakeSpeech, downloadBake, isModelLoaded, previewVoice, loadTts,
  BAKE_VOICES, type BakeFormat, type BakeResult
} from './audioBake';
import { Field, Row, SelectInput } from './fields';

// Editor-side voice baking. Kokoro synthesizes the waveform in-browser, so
// there is no capture step and no "share this tab" dance - it just works,
// the same on every OS. First bake downloads the voice model (~86MB), then
// it is cached. The baked file embeds in the course and needs no runtime
// TTS from the learner.

export function BakeNarration({ slideId }: { slideId: string }) {
  const mutate = useProjectStore((s) => s.mutate);
  const slide = useProjectStore((s) => s.project.slides.find((sl) => sl.id === slideId));
  const [voice, setVoice] = useState(BAKE_VOICES[0].id);
  const [format, setFormat] = useState<BakeFormat>('wav');
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

  const notes = slide?.notes?.trim() ?? '';
  const canBake = notes.length > 0;

  const bake = async () => {
    if (!canBake) return;
    setBusy(true);
    setResult(null);
    setProgress(0);
    setMessage(isModelLoaded() ? 'Synthesizing...' : 'Loading the voice model (first time only, ~86MB)...');
    try {
      const r = await bakeSpeech({
        text: notes,
        voiceId: voice,
        format,
        onProgress: (p) => setProgress(Math.round(p))
      });
      setResult(r);
      setMessage(`Baked ${r.seconds.toFixed(1)}s of narration.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Bake failed.');
    } finally {
      setBusy(false);
    }
  };

  const baseName = `${(slide?.name ?? 'narration').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  const addToTimeline = (asNarration: boolean) => {
    if (!result) return;
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slideId);
      if (!s) return;
      const seconds = Math.round(result.seconds * 10) / 10;
      s.timeline = s.timeline ?? { duration: Math.max(1, seconds), autoAdvance: false };
      if (asNarration) s.timeline.duration = Math.max(s.timeline.duration, seconds);
      const block = createBlock('audio', 40, s.height - 96);
      block.name = asNarration ? 'Narration' : 'Audio';
      const ap = block.props as AudioProps;
      ap.src = result.dataUrl;
      ap.label = asNarration ? 'Narration' : 'Audio clip';
      ap.controls = !asNarration;
      ap.hideInPlayer = asNarration;
      block.timing = { start: 0, end: seconds };
      s.layers[0].blocks.push(block);
      s.timeline.narrationSrc = undefined;
      s.timeline.tts = undefined;
    });
    setMessage(asNarration
      ? 'Added as a narration track (drives the slide length, hidden in the player).'
      : 'Added as an audio block - move, trim, and trigger it like any object.');
  };

  return (
    <div className="bake-narration">
      <Row>
        <Field label="Voice">
          <SelectInput
            value={voice}
            options={BAKE_VOICES.map((v) => ({ value: v.id, label: v.label }))}
            onChange={(v) => setVoice(v)}
          />
        </Field>
        <Field label="Format">
          <SelectInput
            value={format}
            options={[{ value: 'wav', label: 'WAV' }, { value: 'mp3', label: 'MP3' }]}
            onChange={(v) => setFormat(v as BakeFormat)}
          />
        </Field>
      </Row>
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
              ? (previewing ? `Synthesizing preview... ${progress}%` : `Synthesizing narration... ${progress}%`)
              : `Downloading voice model... ${progress}%`}
          </span>
        </div>
      )}
      <button className="btn btn-accent" onClick={bake} disabled={!canBake || busy} style={{ marginTop: 6 }}>
        {busy ? (progress > 0 && progress < 100 ? `Loading model ${progress}%` : 'Baking...') : `Bake to ${format.toUpperCase()}`}
      </button>
      {!canBake && <p className="hint">Add speaker notes above to bake them into narration.</p>}
      {result && (
        <div className="bake-result">
          <audio src={result.dataUrl} controls style={{ width: '100%' }} />
          <div className="field-row" style={{ marginTop: 6 }}>
            <button className="btn" onClick={() => downloadBake(result, baseName, format)}>Download .{format}</button>
            <button className="btn btn-accent" onClick={() => addToTimeline(false)}>Add to timeline</button>
            <button className="btn" onClick={() => addToTimeline(true)} title="Adds it as a hidden track that sets the slide length">Add as narration</button>
          </div>
        </div>
      )}
      {message && <p className="hint bake-message">{message}</p>}
      <p className="hint">
        The voice is synthesized in your browser, so it works the same on every
        OS with no screen-share prompt. The first preview or bake downloads the
        model (about 86MB, one time) - it runs in the background and is then
        cached; the baked file embeds in the course.
      </p>
    </div>
  );
}
