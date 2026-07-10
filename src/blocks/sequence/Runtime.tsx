import { useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { SequenceProps } from '../../schema/types';
import { sequenceVariableName } from '../../schema/factory';

// Fisher-Yates, re-rolled until the order differs from the answer so the
// exercise never starts solved (except the degenerate 1-item case).
function shuffled(ids: string[]): string[] {
  if (ids.length < 2) return [...ids];
  for (let attempt = 0; attempt < 10; attempt++) {
    const arr = [...ids];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr.some((id, i) => id !== ids[i])) return arr;
  }
  return [...ids].reverse();
}

export function SequenceRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as SequenceProps;
  const [order, setOrder] = useState<string[]>(() => shuffled(props.items.map((i) => i.id)));
  const [result, setResult] = useState<null | boolean>(null);

  const moveRow = (idx: number, dir: -1 | 1) => {
    if (result === true) return;
    const to = idx + dir;
    if (to < 0 || to >= order.length) return;
    setOrder((o) => {
      const next = [...o];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
    if (result !== null) setResult(null);
  };

  const check = () => {
    const correct = order.every((id, i) => props.items[i]?.id === id);
    setResult(correct);
    runtime.setVariableByName(sequenceVariableName(block.id), correct);
    const answer = order.map((id) => props.items.find((i) => i.id === id)?.text ?? id).join(' > ');
    runtime.reportInteraction(block.id, answer, correct);
  };

  const reset = () => { setOrder(shuffled(props.items.map((i) => i.id))); setResult(null); };
  const itemOf = (id: string) => props.items.find((i) => i.id === id);

  return (
    <div className="seq-block live" onClick={(e) => e.stopPropagation()}>
      <p className="seq-question">{props.question}</p>
      {order.map((id, i) => {
        const it = itemOf(id);
        if (!it) return null;
        const graded = result !== null ? (props.items[i]?.id === id ? 'ok' : 'no') : '';
        return (
          <div key={id} className={`seq-row live ${graded}`}>
            <span className="seq-num">{i + 1}</span>
            <span className="seq-text">{it.text}</span>
            <span className="seq-arrows">
              <button onClick={() => moveRow(i, -1)} disabled={i === 0 || result === true} aria-label={`Move "${it.text}" up`}>▲</button>
              <button onClick={() => moveRow(i, 1)} disabled={i === order.length - 1 || result === true} aria-label={`Move "${it.text}" down`}>▼</button>
            </span>
          </div>
        );
      })}
      {result !== true && <button className="seq-check" onClick={check}>Check</button>}
      {result !== null && (
        <div className={`seq-feedback ${result ? 'correct' : 'incorrect'}`}>
          <span>{result ? props.feedbackCorrect : props.feedbackIncorrect}</span>
          {!result && <button className="seq-retry" onClick={reset}>Shuffle & retry</button>}
        </div>
      )}
    </div>
  );
}
