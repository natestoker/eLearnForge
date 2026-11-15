import { FeedbackMark } from '../../shared/FeedbackMark';
import { useId, useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { MultipleChoiceProps } from '../../schema/types';
import { mcVariableName } from '../../schema/factory';
import { useFocusOnResult } from '../../shared/useFocusOnResult';

function MarkIcon({ ok }: { ok?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {ok ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <><path d="m7 7 10 10" /><path d="m17 7-10 10" /></>}
    </svg>
  );
}

export function MultipleChoiceRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as MultipleChoiceProps;
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  const locked = runtime.attemptsExhausted(block.id);
  const feedbackRef = useFocusOnResult<HTMLDivElement>(result !== null);
  const qid = useId();

  const toggle = (id: string) => {
    if (result !== null) return;
    setSelected((prev) => {
      if (props.allowMultiple) {
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      }
      return [id];
    });
  };

  const submit = () => {
    if (selected.length === 0) return;
    const correctSet = new Set(props.correctChoiceIds);
    const correct =
      selected.length === correctSet.size && selected.every((id) => correctSet.has(id));
    setResult(correct);
    // The contract from the brief: submit sets mc_{blockId}_correct, which
    // slide triggers can key off of.
    runtime.setVariableByName(mcVariableName(block.id), correct);
    // Report the answer semantically; SCORM/xAPI adapters translate it.
    const responseText = props.choices
      .filter((c) => selected.includes(c.id))
      .map((c) => c.text)
      .join('; ');
    const idxOf = (ids: string[]) =>
      ids.map((id) => props.choices.findIndex((c) => c.id === id)).filter((i) => i >= 0);
    runtime.reportInteraction(block.id, responseText, correct, {
      kind: 'choice',
      description: props.question,
      choices: props.choices.map((c) => c.text),
      learner: idxOf(selected),
      correct: idxOf(props.correctChoiceIds)
    });
  };

  const retry = () => {
    setSelected([]);
    setResult(null);
  };

  return (
    <div className="mc-block live" role="group" aria-labelledby={qid} onClick={(e) => e.stopPropagation()}>
      <p className="mc-question" id={qid}>{props.question}</p>
      {props.allowMultiple && <p className="mc-hint">Choose all that apply.</p>}
      <div className="mc-choices">
        {props.choices.map((c, i) => {
          const isSelected = selected.includes(c.id);
          // After Submit each choice shows how it was marked, with an icon and
          // not colour alone: the right answer, and a wrong pick.
          // The right answer is only revealed once there is nothing left to try.
          const isRight = result !== null && props.correctChoiceIds.includes(c.id) && (result === true || locked);
          const isWrongPick = result !== null && isSelected && !props.correctChoiceIds.includes(c.id);
          return (
            <button
              key={c.id}
              className={`mc-choice live ${isSelected ? 'selected' : ''}${isRight ? ' right' : ''}${isWrongPick ? ' wrong' : ''}`}
              role={props.allowMultiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              onClick={() => toggle(c.id)}
              disabled={result !== null}
            >
              <span className={`mc-mark ${props.allowMultiple ? 'square' : 'round'} ${isSelected ? 'filled' : ''}`} aria-hidden="true">
                {isRight ? <MarkIcon ok /> : isWrongPick ? <MarkIcon /> : String.fromCharCode(65 + (i % 26))}
              </span>
              <span className="mc-choice-text">{c.text}</span>
              {isRight && <span className="sr-only"> (correct answer)</span>}
              {isWrongPick && <span className="sr-only"> (your answer, incorrect)</span>}
            </button>
          );
        })}
      </div>
      {result !== null && <div className="sr-only" role="alert">{result ? props.feedbackCorrect : props.feedbackIncorrect}</div>}
      {result === null ? (
        <button className="mc-submit live" onClick={submit} disabled={selected.length === 0}>
          Submit
        </button>
      ) : (
        <div className={`mc-feedback ${result ? 'correct' : 'incorrect'}`} ref={feedbackRef} tabIndex={-1} role="region" aria-label={result ? props.feedbackCorrect : props.feedbackIncorrect}>
          <FeedbackMark correct={result} />
          <p>{result ? props.feedbackCorrect : props.feedbackIncorrect}</p>
          {!result && !locked && (
            <button className="mc-submit live" onClick={retry}>Try again</button>
          )}
          {locked && !result && <p className="attempts-note">No attempts left.</p>}
        </div>
      )}
    </div>
  );
}
