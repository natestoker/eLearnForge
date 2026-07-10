import { useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { ScenarioProps } from '../../schema/types';
import { scenarioDoneVariableName } from '../../schema/factory';

// Branching dialogue: each choice jumps to another passage; a passage with
// no choices is an ending. Reaching one sets sc_{blockId}_done and reports
// the taken path for tracking.
export function ScenarioRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as ScenarioProps;
  const [currentId, setCurrentId] = useState(props.passages[0]?.id);
  const [path, setPath] = useState<string[]>([]);
  const [ended, setEnded] = useState(false);

  const current = props.passages.find((p) => p.id === currentId);
  if (!current) return <div className="sc-block live" />;

  const pick = (label: string, targetId: string) => {
    const nextPath = [...path, label];
    setPath(nextPath);
    const target = targetId ? props.passages.find((p) => p.id === targetId) : undefined;
    if (!target || target.choices.length === 0) {
      // Jumping to an ending (or to nowhere) completes the scenario once we land.
      if (target) setCurrentId(target.id);
      if (!ended) {
        setEnded(true);
        runtime.setVariableByName(scenarioDoneVariableName(block.id), true);
        runtime.reportInteraction(block.id, nextPath.join(' > '), true);
      }
      if (!target) setCurrentId(current.id);
    } else {
      setCurrentId(target.id);
    }
  };

  const restart = () => {
    setCurrentId(props.passages[0]?.id);
    setPath([]);
  };

  return (
    <div className="sc-block live" onClick={(e) => e.stopPropagation()}>
      {current.speaker && <span className="sc-speaker">{current.speaker}</span>}
      <p className="sc-text">{current.text}</p>
      <div className="sc-choices">
        {current.choices.map((c) => (
          <button key={c.id} className="sc-choice live" onClick={() => pick(c.label, c.targetId)}>
            {c.label}
          </button>
        ))}
        {current.choices.length === 0 && (
          <div className="sc-end">
            <span className="sc-end-badge">End of scenario</span>
            <button className="sc-restart" onClick={restart}>Start over</button>
          </div>
        )}
      </div>
    </div>
  );
}
