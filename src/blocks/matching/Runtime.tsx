import { useId, useMemo, useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { MatchingProps } from '../../schema/types';

// Click-to-connect matching. Learner picks a left prompt, then a right
// answer; they link. Submitting checks every link against the authored
// pairs. Right-column order is shuffled so it isn't a giveaway.
export function MatchingRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as MatchingProps;
  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({}); // leftId -> rightId
  const [checked, setChecked] = useState(false);
  const locked = runtime.attemptsExhausted(block.id);
  const qid = useId();

  const rights = useMemo(() => {
    const arr = props.pairs.map((p) => ({ id: p.id, text: p.right }));
    // Deterministic shuffle by id so it stays stable across re-renders.
    return arr.sort((a, b) => (a.id + a.text).localeCompare(b.id + b.text));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  const pickLeft = (id: string) => { if (!checked) setActiveLeft((cur) => (cur === id ? null : id)); };
  const pickRight = (rightId: string) => {
    if (checked || !activeLeft) return;
    setLinks((l) => {
      const next = { ...l };
      // A right answer can only be linked once; clear any prior use.
      for (const k of Object.keys(next)) if (next[k] === rightId) delete next[k];
      next[activeLeft] = rightId;
      return next;
    });
    setActiveLeft(null);
  };

  const allLinked = props.pairs.every((p) => links[p.id]);
  const correct = props.pairs.every((p) => links[p.id] === p.id);

  return (
    <div className="match-block runtime" role="group" aria-labelledby={qid}>
      <div className="match-question" id={qid}>{props.question}</div>
      <div className="match-cols">
        <div className="match-col">
          {props.pairs.map((p) => (
            <button
              key={p.id}
              className={`match-item left ${activeLeft === p.id ? 'active' : ''} ${links[p.id] ? 'linked' : ''} ${checked ? (links[p.id] === p.id ? 'right' : 'wrong') : ''}`}
              aria-pressed={activeLeft === p.id}
              onClick={() => pickLeft(p.id)}
            >
              {p.left}
              {links[p.id] && <span className="match-badge">{'\u2192'} {props.pairs.find((x) => x.id === links[p.id])?.right}</span>}
            </button>
          ))}
        </div>
        <div className="match-col">
          {rights.map((r) => {
            const usedBy = Object.keys(links).find((k) => links[k] === r.id);
            return (
              <button
                key={r.id}
                className={`match-item right ${usedBy ? 'linked' : ''}`}
                onClick={() => pickRight(r.id)}
              >
                {r.text}
              </button>
            );
          })}
        </div>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{checked ? (correct ? (props.feedbackCorrect || 'Correct!') : (props.feedbackIncorrect || 'Not quite - try again.')) : ''}</div>
      {!checked ? (
        <button className="btn btn-accent match-submit" disabled={!allLinked} onClick={() => {
          setChecked(true);
          const response = props.pairs
            .map((p) => `${p.left} = ${props.pairs.find((q) => q.id === links[p.id])?.right ?? '?'}`)
            .join('; ');
          const idx = (id: string | undefined) => props.pairs.findIndex((q) => q.id === id);
          runtime.reportInteraction(block.id, response, correct, {
            kind: 'matching',
            description: props.question,
            sources: props.pairs.map((p) => p.left),
            targets: props.pairs.map((p) => p.right),
            learner: props.pairs.flatMap((p, s) => (idx(links[p.id]) >= 0 ? [[s, idx(links[p.id])] as [number, number]] : [])),
            correct: props.pairs.map((_, i) => [i, i] as [number, number])
          });
        }}>Check</button>
      ) : (
        <div className={`match-feedback ${correct ? 'ok' : 'no'}`}>
          {correct ? (props.feedbackCorrect || 'Correct!') : (props.feedbackIncorrect || 'Not quite - try again.')}
          {!correct && !locked && <button className="btn match-retry" onClick={() => { setChecked(false); setLinks({}); }}>Try again</button>}
          {locked && !correct && <p className="attempts-note">No attempts left.</p>}
        </div>
      )}
    </div>
  );
}
