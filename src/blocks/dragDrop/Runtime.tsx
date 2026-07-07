import { useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { DragDropProps } from '../../schema/types';
import { dragDropVariableName } from '../../schema/factory';

// Placement map: itemId -> targetId, or 'bank' when unplaced.
type Placement = Record<string, string>;

export function DragDropRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as DragDropProps;
  const [placement, setPlacement] = useState<Placement>(() =>
    Object.fromEntries(props.items.map((i) => [i.id, 'bank']))
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [result, setResult] = useState<null | boolean>(null);

  const move = (itemId: string, zone: string) => {
    if (result === true) return;
    setPlacement((p) => ({ ...p, [itemId]: zone }));
    if (result !== null) setResult(null);
  };

  const bank = props.items.filter((i) => (placement[i.id] ?? 'bank') === 'bank');
  const inTarget = (tid: string) => props.items.filter((i) => placement[i.id] === tid);
  const allPlaced = props.items.every((i) => placement[i.id] !== 'bank');

  const check = () => {
    const correct = props.items.every((i) => placement[i.id] === i.targetId);
    setResult(correct);
    runtime.setVariableByName(dragDropVariableName(block.id), correct);
    runtime.reportInteraction(block.id, props.items.map((i) => `${i.text}->${placement[i.id]}`).join('; '), correct);
  };

  const reset = () => { setPlacement(Object.fromEntries(props.items.map((i) => [i.id, 'bank']))); setResult(null); };

  const Item = ({ id, text }: { id: string; text: string }) => (
    <div
      className={`dd-item ${dragId === id ? 'dragging' : ''}`}
      draggable={result !== true}
      onDragStart={() => setDragId(id)}
      onDragEnd={() => setDragId(null)}
    >
      {text}
    </div>
  );

  const dropProps = (zone: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); if (dragId) move(dragId, zone); setDragId(null); }
  });

  return (
    <div className="dd-block live" onClick={(e) => e.stopPropagation()}>
      <p className="dd-question">{props.question}</p>
      <div className="dd-bank" {...dropProps('bank')}>
        {bank.length === 0 ? <span className="dd-bank-empty">All placed</span> : bank.map((i) => <Item key={i.id} id={i.id} text={i.text} />)}
      </div>
      <div className="dd-targets">
        {props.targets.map((t) => (
          <div key={t.id} className="dd-target" {...dropProps(t.id)}>
            <div className="dd-target-label">{t.label}</div>
            <div className="dd-target-items">
              {inTarget(t.id).map((i) => (
                <div key={i.id} className={result !== null ? (placement[i.id] === i.targetId ? 'dd-graded ok' : 'dd-graded no') : ''}>
                  <Item id={i.id} text={i.text} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {result === null || result === false ? (
        <button className="dd-check" onClick={check} disabled={!allPlaced}>Check</button>
      ) : null}
      {result !== null && (
        <div className={`dd-feedback ${result ? 'correct' : 'incorrect'}`}>
          <span>{result ? props.feedbackCorrect : props.feedbackIncorrect}</span>
          {!result && <button className="dd-retry" onClick={reset}>Reset</button>}
        </div>
      )}
    </div>
  );
}
