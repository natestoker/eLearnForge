import { useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { MultipleChoiceProps } from '../../schema/types';
import { mcVariableName } from '../../schema/factory';

export function MultipleChoiceRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as MultipleChoiceProps;
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<null | boolean>(null);

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
    runtime.reportInteraction(block.id, responseText, correct);
  };

  const retry = () => {
    setSelected([]);
    setResult(null);
  };

  return (
    <div className="mc-block live" onClick={(e) => e.stopPropagation()}>
      <p className="mc-question">{props.question}</p>
      <div className="mc-choices">
        {props.choices.map((c) => {
          const isSelected = selected.includes(c.id);
          return (
            <button
              key={c.id}
              className={`mc-choice live ${isSelected ? 'selected' : ''}`}
              onClick={() => toggle(c.id)}
              disabled={result !== null}
            >
              <span
                className={`mc-mark ${props.allowMultiple ? 'square' : 'round'} ${isSelected ? 'filled' : ''}`}
              />
              <span className="mc-choice-text">{c.text}</span>
            </button>
          );
        })}
      </div>
      {result === null ? (
        <button className="mc-submit live" onClick={submit} disabled={selected.length === 0}>
          Submit
        </button>
      ) : (
        <div className={`mc-feedback ${result ? 'correct' : 'incorrect'}`}>
          <p>{result ? props.feedbackCorrect : props.feedbackIncorrect}</p>
          {!result && (
            <button className="mc-submit live" onClick={retry}>Try again</button>
          )}
        </div>
      )}
    </div>
  );
}
