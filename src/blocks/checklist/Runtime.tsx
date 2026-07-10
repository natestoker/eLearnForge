import { useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { ChecklistProps } from '../../schema/types';
import { checklistDoneVariableName } from '../../schema/factory';

// All items checked sets cl_{blockId}_done true; unchecking clears it, so
// the gate stays honest if the learner changes their mind.
export function ChecklistRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as ChecklistProps;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string, v: boolean) => {
    const next = { ...checked, [id]: v };
    setChecked(next);
    runtime.setVariableByName(
      checklistDoneVariableName(block.id),
      props.items.every((it) => next[it.id])
    );
  };

  return (
    <div className="cl-block live" onClick={(e) => e.stopPropagation()}>
      {props.title && <p className="cl-title">{props.title}</p>}
      {props.items.map((it) => (
        <label key={it.id} className={`cl-row live ${checked[it.id] ? 'done' : ''}`}>
          <input
            type="checkbox"
            checked={!!checked[it.id]}
            onChange={(e) => toggle(it.id, e.target.checked)}
          />
          <span className="cl-text">{it.text}</span>
        </label>
      ))}
    </div>
  );
}
