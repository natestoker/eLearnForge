import { useState } from 'react';
import { useFocusOnResult } from '../../shared/useFocusOnResult';
import type { RuntimeRendererProps } from '../blockApi';
import type { FillBlankProps } from '../../schema/types';
import { fillBlankVariableName } from '../../schema/factory';

export function FillBlankRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as FillBlankProps;
  const [value, setValue] = useState('');
  const [result, setResult] = useState<null | boolean>(null);
  const locked = runtime.attemptsExhausted(block.id);
  const feedbackRef = useFocusOnResult<HTMLParagraphElement>(result === true);
  const parts = props.question.split('___');

  const check = () => {
    if (!value.trim()) return;
    const norm = (s: string) => (props.caseSensitive ? s.trim() : s.trim().toLowerCase());
    const correct = props.correctAnswers.some((a) => norm(a) === norm(value));
    setResult(correct);
    runtime.setVariableByName(fillBlankVariableName(block.id), correct);
    runtime.reportInteraction(block.id, value, correct, {
      kind: 'fill-in',
      description: props.question,
      learner: value,
      correct: props.correctAnswers,
      caseSensitive: !!props.caseSensitive
    });
  };

  return (
    <div className="fb-block live" style={{ fontSize: props.fontSize }} onClick={(e) => e.stopPropagation()}>
      <p className="fb-question">
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && <span className="fb-blank-slot" />}
          </span>
        ))}
      </p>
      <div className="fb-row">
        <input
          className="fb-input"
          aria-label="Your answer"
          value={value}
          placeholder="Type your answer"
          disabled={result === true || locked}
          onChange={(e) => { setValue(e.target.value); if (result !== null) setResult(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') check(); }}
        />
        {result !== true && !locked && <button className="fb-check" onClick={check} disabled={!value.trim()}>Check</button>}
      </div>
      {result !== null && (
        <p className={`fb-feedback ${result ? 'correct' : 'incorrect'}`} ref={feedbackRef} tabIndex={-1}>
          {result ? props.feedbackCorrect : props.feedbackIncorrect}
        </p>
      )}
      <div className="sr-only" role="status" aria-live="polite">{result === false ? props.feedbackIncorrect : ''}</div>
      {locked && !result && <p className="attempts-note">No attempts left.</p>}
    </div>
  );
}
