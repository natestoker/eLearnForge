import { useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { FillBlankProps } from '../../schema/types';
import { fillBlankVariableName } from '../../schema/factory';

export function FillBlankRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as FillBlankProps;
  const [value, setValue] = useState('');
  const [result, setResult] = useState<null | boolean>(null);
  const parts = props.question.split('___');

  const check = () => {
    if (!value.trim()) return;
    const norm = (s: string) => (props.caseSensitive ? s.trim() : s.trim().toLowerCase());
    const correct = props.correctAnswers.some((a) => norm(a) === norm(value));
    setResult(correct);
    runtime.setVariableByName(fillBlankVariableName(block.id), correct);
    runtime.reportInteraction(block.id, value, correct);
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
          value={value}
          placeholder="Type your answer"
          disabled={result === true}
          onChange={(e) => { setValue(e.target.value); if (result !== null) setResult(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') check(); }}
        />
        {result !== true && <button className="fb-check" onClick={check} disabled={!value.trim()}>Check</button>}
      </div>
      {result !== null && (
        <p className={`fb-feedback ${result ? 'correct' : 'incorrect'}`}>
          {result ? props.feedbackCorrect : props.feedbackIncorrect}
        </p>
      )}
    </div>
  );
}
