import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import type { PublishTarget } from '../tracking';
import { buildPackage, downloadBlob, packageFilename, playerRuntimeBytes, publishAvailable } from '../publish/packager';
import { formatBytes, runChecks, sizeEstimate, SIZE_LIMIT_BYTES } from '../publish/checks';
import type { Check } from '../publish/checks';
import { storylineSnippet } from '../publish/storylineSnippet';
import { gradedBlockIds, passingScoreOf } from '../engine/scoring';
import type { CompletionMode } from '../schema/types';
import { Lucide } from './lucide';

type DialogTarget = PublishTarget | 'rise';

const TARGETS: { value: DialogTarget; name: string; sub: string; icon: string; note?: string }[] = [
  { value: 'web', name: 'Web', sub: 'Standalone HTML, no LMS', icon: 'globe',
    note: 'Web exports do not report to an LMS, so completion and pass or fail are not sent. The course still resumes in the same browser.' },
  { value: 'scorm12', name: 'SCORM 1.2', sub: 'Broadest LMS support', icon: 'package' },
  { value: 'scorm2004', name: 'SCORM 2004', sub: '4th edition', icon: 'package-check' },
  { value: 'xapi', name: 'xAPI', sub: 'Statements to an LRS', icon: 'radio-tower' },
  { value: 'storyline', name: 'Storyline web object', sub: 'Embed in a .story', icon: 'app-window',
    note: 'Results are posted to the Storyline page that embeds this course (bridge code below). The Storyline course decides what the LMS records.' },
  { value: 'rise', name: 'Rise', sub: 'Embed as a Rise block', icon: 'layout-list',
    note: 'Completion is posted to the Rise page that embeds this course. Rise decides what the LMS records.' }
];

const COMPLETIONS: { value: CompletionMode; name: string; sub: string }[] = [
  { value: 'allSlides', name: 'All slides viewed', sub: 'Complete when every slide has been visited' },
  { value: 'explicit', name: 'Explicit trigger', sub: 'Complete when a "Complete course" action runs' },
  { value: 'passed', name: 'Passed quiz', sub: 'Complete when the score meets the pass mark' },
  { value: 'viewedAndPassed', name: 'Viewed and passed', sub: 'Both conditions must be met' }
];

const SEV = {
  error: { icon: 'circle-x', cls: 'err' },
  warn: { icon: 'triangle-alert', cls: 'warn' },
  pass: { icon: 'circle-check', cls: 'pass' }
} as const;

export function PublishDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const mutate = useProjectStore((s) => s.mutate);
  const select = useProjectStore((s) => s.select);
  const setRibbonTab = useUiStore((s) => s.setRibbonTab);
  const setFocusTriggerId = useUiStore((s) => s.setFocusTriggerId);

  const [target, setTarget] = useState<DialogTarget>('scorm12');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const ready = publishAvailable();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mode: CompletionMode = project.completion?.mode ?? 'allSlides';
  const autoScore = !!project.completion?.autoScore;
  const maxAttempts = project.completion?.maxAttempts ?? 0;
  const pass = passingScoreOf(project);
  const graded = gradedBlockIds(project).length;
  const info = TARGETS.find((t) => t.value === target)!;
  const quizMode = mode === 'passed' || mode === 'viewedAndPassed';

  const checks = useMemo(() => runChecks(project, target), [project, target]);
  const size = useMemo(() => sizeEstimate(project, playerRuntimeBytes()), [project]);
  const nErr = checks.filter((c) => c.sev === 'error').length;
  const nWarn = checks.filter((c) => c.sev === 'warn').length;
  const nPass = checks.length - nErr - nWarn;
  const pct = Math.round((size.total / SIZE_LIMIT_BYTES) * 100);
  const filename = packageFilename(project, target);

  const setCompletion = (patch: Record<string, unknown>) =>
    mutate((p) => { p.completion = { mode, ...p.completion, ...patch } as typeof p.completion; }, false);

  const publish = async () => {
    setBusy(true);
    setMessage('');
    setDone(null);
    try {
      const result = await buildPackage(project, target);
      downloadBlob(result);
      setDone(result.filename);
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

  const fix = (c: Check) => {
    if (!c.fix) return;
    const slide = project.slides.find((s) => s.id === c.fix!.slideId);
    if (!slide) return;
    select({ slideId: slide.id, layerId: slide.layers[0].id, blockId: c.fix.blockId ?? null });
    if (c.fix.triggerId) { setRibbonTab('triggers'); setFocusTriggerId(c.fix.triggerId); }
    else setRibbonTab('home');
    onClose();
  };

  let status = nErr ? `Resolve ${nErr} error${nErr > 1 ? 's' : ''} to publish`
    : nWarn ? `${nWarn} warning${nWarn > 1 ? 's' : ''}. You can still publish.` : 'Ready to publish';
  let statusCls = nErr ? 'err' : '';
  if (busy) { status = 'Building package…'; statusCls = ''; }
  else if (done) { status = `Package ready · ${formatBytes(size.total)}`; statusCls = 'ok'; }
  else if (message) { status = message; statusCls = /failed|blocked/i.test(message) ? 'err' : ''; }
  else if (!ready) { status = 'Publishing needs the built app: run npm run build and publish from dist/index.html.'; statusCls = 'err'; }

  const canPublish = nErr === 0 && ready && !busy;

  return (
    <div className="pd-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pd-root" role="dialog" aria-modal="true" aria-labelledby="pd-title">
        <div className="pd-head">
          <div className="pd-head-text">
            <div id="pd-title" className="pd-title">Publish course</div>
            <div className="pd-sub">{project.title} · {project.slides.length} slide{project.slides.length === 1 ? '' : 's'}</div>
          </div>
          <button type="button" className="pd-close" aria-label="Close" onClick={onClose}><Lucide name="x" size={16} /></button>
        </div>

        <div className="pd-body">
          <div className="pd-col">
            <section className="pd-section">
              <div className="pd-label">Target</div>
              <div className="pd-targets" role="radiogroup" aria-label="Target">
                {TARGETS.map((t) => {
                  const sel = t.value === target;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      className={`pd-target${sel ? ' sel' : ''}`}
                      onClick={() => { setTarget(t.value); setDone(null); setMessage(''); }}
                    >
                      <Lucide name={t.icon} size={18} className="pd-target-icon" />
                      <span className="pd-target-name">{t.name}</span>
                      <span className="pd-target-sub">{t.sub}</span>
                    </button>
                  );
                })}
              </div>
              {target === 'storyline' && (
                <button type="button" className="pd-btn" onClick={copySnippet}>Copy Storyline bridge code</button>
              )}
            </section>

            <section className="pd-section">
              <div className="pd-label">Tracking</div>
              {info.note && (
                <div className="pd-note"><Lucide name="info" size={15} /><span>{info.note}</span></div>
              )}
              {target !== 'web' && (
                <div className="pd-radios" role="radiogroup" aria-label="Completion rule">
                  <div className="pd-card-title pd-radios-title">Completion rule</div>
                  {COMPLETIONS.map((c) => {
                    const sel = c.value === mode;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={sel}
                        className={`pd-radio${sel ? ' sel' : ''}`}
                        onClick={() => setCompletion({ mode: c.value })}
                      >
                        <span className="pd-radio-ring"><span className="pd-radio-dot" /></span>
                        <span className="pd-radio-text"><span>{c.name}</span><span className="pd-radio-sub">{c.sub}</span></span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pd-pair">
                {target !== 'web' && (
                  <div className="pd-card">
                    <label htmlFor="pd-pass" className="pd-card-title">Pass mark</label>
                    <div className="pd-pass-row">
                      <input
                        id="pd-pass"
                        type="range" min={0} max={100} step={5}
                        value={pass}
                        onChange={(e) => setCompletion({ passingScore: Number(e.target.value) })}
                      />
                      <div className="pd-num">
                        <input
                          aria-label="Pass mark percent"
                          type="number" min={0} max={100}
                          value={pass}
                          onChange={(e) => setCompletion({ passingScore: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        />
                        <span>%</span>
                      </div>
                    </div>
                    <div className="pd-help">
                      {quizMode ? 'Score needed to pass the quiz.' : 'Also sets passed or failed in the LMS when a score is reported.'}
                    </div>
                  </div>
                )}
                <div className="pd-card">
                  <span className="pd-card-title">Max attempts</span>
                  <div className="pd-stepper">
                    <button type="button" aria-label="Fewer attempts" onClick={() => setCompletion({ maxAttempts: Math.max(0, maxAttempts - 1) })}><Lucide name="minus" size={14} /></button>
                    <div className="pd-stepper-val" aria-live="polite">{maxAttempts === 0 ? 'Unlimited' : String(maxAttempts)}</div>
                    <button type="button" aria-label="More attempts" onClick={() => setCompletion({ maxAttempts: Math.min(10, maxAttempts + 1) })}><Lucide name="plus" size={14} /></button>
                  </div>
                  <div className="pd-help">Answers allowed per question. After the last one the question locks. 0 = unlimited.</div>
                </div>
              </div>

              <label className="pd-card pd-check">
                <input
                  type="checkbox"
                  checked={autoScore}
                  onChange={(e) => setCompletion({ autoScore: e.target.checked })}
                />
                <span className="pd-check-text">
                  <span className="pd-card-title">Calculate score from answers</span>
                  <span className="pd-help">
                    {autoScore
                      ? `Percent of the ${graded} scored question${graded === 1 ? '' : 's'} (multiple choice, fill-in, drag-drop, sequence, matching) answered correctly. Unanswered counts as wrong; a retry replaces the earlier answer.`
                      : 'Off: the score only changes when a Set score trigger runs.'}
                  </span>
                </span>
              </label>
            </section>
          </div>

          <div className="pd-col">
            <section className="pd-section">
              <div className="pd-checks-head">
                <span className="pd-label pd-grow">Publish checks</span>
                <span className="pd-count err"><Lucide name="circle-x" size={13} />{nErr}</span>
                <span className="pd-count warn"><Lucide name="triangle-alert" size={13} />{nWarn}</span>
                <span className="pd-count pass"><Lucide name="circle-check" size={13} />{nPass}</span>
              </div>
              <div className="pd-checks">
                {checks.map((c, i) => (
                  <div key={i} className={`pd-check-row ${SEV[c.sev].cls}`}>
                    <Lucide name={SEV[c.sev].icon} size={16} className="pd-check-icon" />
                    <div className="pd-check-main">
                      <span className={`pd-check-title${c.sev === 'pass' ? '' : ' strong'}`}>{c.title}</span>
                      {c.detail && <span className="pd-check-detail">{c.detail}</span>}
                    </div>
                    {c.fix && <button type="button" className="pd-fix" onClick={() => fix(c)}>{c.fix.label}</button>}
                  </div>
                ))}
              </div>
            </section>

            <section className="pd-section">
              <div className="pd-label">Package size</div>
              <div className="pd-size">
                <div className="pd-size-top">
                  <span className="pd-size-total">{formatBytes(size.total)}</span>
                  <span className="pd-size-limit">of {formatBytes(SIZE_LIMIT_BYTES)} typical LMS upload limit</span>
                  <span className={`pd-size-pct${pct > 80 ? ' warn' : ''}`}>{pct}%</span>
                </div>
                <div className="pd-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)} aria-label="Package size">
                  {size.parts.map((p) => (
                    <div key={p.label} style={{ width: `${Math.min(100, (p.bytes / SIZE_LIMIT_BYTES) * 100).toFixed(2)}%`, background: p.color }} />
                  ))}
                </div>
                <div className="pd-legend">
                  {size.parts.map((p) => (
                    <div key={p.label} className="pd-legend-row">
                      <span className="pd-swatch" style={{ background: p.color }} />
                      <span className="pd-legend-label">{p.label}</span>
                      <span className="pd-legend-size">{formatBytes(p.bytes)}</span>
                    </div>
                  ))}
                </div>
                <div className="pd-help">Estimate from the embedded media. The final file can differ slightly.</div>
              </div>
            </section>
          </div>
        </div>

        <div className="pd-foot">
          <div className="pd-foot-text">
            <span className="pd-file">{filename}</span>
            <span className={`pd-status ${statusCls}`} role="status">{status}</span>
          </div>
          <button type="button" className="pd-btn" onClick={onClose}>Cancel</button>
          {canPublish ? (
            <button type="button" className="pd-publish" onClick={publish}>
              <Lucide name={done ? 'check' : 'upload'} size={15} />{done ? 'Publish again' : `Publish ${info.name}`}
            </button>
          ) : (
            <button type="button" className="pd-publish locked" aria-disabled="true" title={busy ? 'Building the package' : nErr ? 'Resolve errors to publish' : 'Publishing needs the built app'}>
              <Lucide name={busy ? 'package' : 'lock'} size={14} />{busy ? 'Building…' : `Publish ${info.name}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
