import { useRef, useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { DragDropProps } from '../../schema/types';
import { dragDropVariableName } from '../../schema/factory';

// Placement map: itemId -> targetId, or 'bank' when unplaced.
type Placement = Record<string, string>;

// Pointer-based dragging instead of HTML5 drag-and-drop: native DnD cancels
// the drag when React re-renders the dragged node, and never worked on touch.
// A pointer drag moves a transform on the original element and hit-tests the
// drop zones on release, which survives re-renders and works everywhere.
export function DragDropRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as DragDropProps;
  const [placement, setPlacement] = useState<Placement>(() =>
    Object.fromEntries(props.items.map((i) => [i.id, 'bank']))
  );
  const [result, setResult] = useState<null | boolean>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const startDrag = (e: React.PointerEvent, itemId: string) => {
    if (result === true || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const zoneAt = (x: number, y: number): string | null => {
      const root = rootRef.current;
      if (!root) return null;
      for (const zoneEl of Array.from(root.querySelectorAll<HTMLElement>('[data-zone]'))) {
        const r = zoneEl.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return zoneEl.dataset.zone ?? null;
      }
      return null;
    };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 4) {
        moved = true;
        el.classList.add('dragging');
      }
      if (moved) el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.classList.remove('dragging');
      el.style.transform = '';
      if (!moved) return;
      const zone = zoneAt(ev.clientX, ev.clientY);
      if (zone && zone !== placement[itemId]) move(itemId, zone);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const renderItem = (i: { id: string; text: string }) => (
    <div
      key={i.id}
      className="dd-item"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => startDrag(e, i.id)}
    >
      {i.text}
    </div>
  );

  return (
    <div className="dd-block live" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <p className="dd-question">{props.question}</p>
      <div className="dd-bank" data-zone="bank">
        {bank.length === 0 ? <span className="dd-bank-empty">All placed</span> : bank.map(renderItem)}
      </div>
      <div className="dd-targets">
        {props.targets.map((t) => (
          <div key={t.id} className="dd-target" data-zone={t.id}>
            <div className="dd-target-label">{t.label}</div>
            <div className="dd-target-items">
              {inTarget(t.id).map((i) => (
                <div key={i.id} className={result !== null ? (placement[i.id] === i.targetId ? 'dd-graded ok' : 'dd-graded no') : ''}>
                  {renderItem(i)}
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
