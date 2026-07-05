import { useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import type { PublishTarget } from '../tracking';

type DialogTarget = PublishTarget | 'rise';
import { buildPackage, downloadBlob, publishAvailable } from '../publish/packager';
import { storylineSnippet } from '../publish/storylineSnippet';
import type { CompletionMode } from '../schema/types';
import { Field, SelectInput } from './fields';

const TARGETS: { value: DialogTarget; label: string; blurb: string }[] = [
  { value: 'web', label: 'Web (single HTML file)', blurb: 'One self-contained HTML file. Host it anywhere or open it from disk. Resumes via the browser.' },
  { value: 'scorm12', label: 'SCORM 1.2 (zip)', blurb: 'The LMS workhorse. Reports progress, answers, score, completion. Resumes via suspend_data. Broadest compatibility.' },
  { value: 'scorm2004', label: 'SCORM 2004 4th Ed. (zip)', blurb: 'Same reporting with 2004 vocabulary: completion and success status split, scaled score.' },
  { value: 'xapi', label: 'xAPI / Tin Can (zip)', blurb: 'Sends statements (initialized, experienced, answered, scored, completed) to the LRS named in the launch URL.' },
  { value: 'storyline', label: 'Storyline web object (zip)', blurb: 'Folder package for Insert > Web Object, plus generated bridge code that pushes results into Storyline variables.' },
  { value: 'rise', label: 'Rise 360 Code Block (zip)', blurb: 'The course plus an iframe snippet for a Rise Code Block, with a postMessage completion bridge. Host the course file, paste the snippet.' }
];

export function PublishDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const mutate = useProjectStore((s) => s.mutate);
  const [target, setTarget] = useState<DialogTarget>('scorm12');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const ready = publishAvailable();
  const completionMode: CompletionMode = project.completion?.mode ?? 'allSlides';
  const info = TARGETS.find((t) => t.value === target)!;

  const publish = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await buildPackage(project, target);
      downloadBlob(result);
      setMessage(`Saved ${result.filename}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Publish failed.');
    } finally {
      setBusy(false);
    }
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(storylineSnippet(project));
      setMessage('Bridge code copied to the clipboard.');
    } catch {
      setMessage('Clipboard blocked; the code is also inside the zip as storyline-bridge.js.');
    }
  };

  return (
    <div className="publish-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="publish-dialog">
        <div className="publish-head">
          <h2>Publish</h2>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <Field label="Target">
          <SelectInput
            value={target}
            options={TARGETS.map((t) => ({ value: t.value, label: t.label }))}
            onChange={(v) => setTarget(v as DialogTarget)}
          />
        </Field>
        <p className="publish-blurb">{info.blurb}</p>

        <Field label="Completion">
          <SelectInput
            value={completionMode}
            options={[
              { value: 'allSlides', label: 'When every slide has been viewed' },
              { value: 'explicit', label: 'Only via a Complete course trigger action' }
            ]}
            onChange={(v) => mutate((p) => { p.completion = { mode: v as CompletionMode }; })}
          />
        </Field>

        {target === 'storyline' && (
          <button className="btn" onClick={copySnippet}>Copy Storyline bridge code</button>
        )}

        {!ready && (
          <p className="publish-warning">
            Publishing needs the built app (the player is baked in at build time).
            Run npm run build and publish from dist/index.html.
          </p>
        )}

        <div className="publish-foot">
          <span className="publish-message">{message}</span>
          <button className="btn btn-accent" disabled={busy || !ready} onClick={publish}>
            {busy ? 'Packaging...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
