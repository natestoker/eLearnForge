import { useEffect, useId, useRef, useState } from 'react';
import { useFocusOnResult } from '../../shared/useFocusOnResult';
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
  const locked = runtime.attemptsExhausted(block.id);
  const qid = useId();
  // Keyboard path: Enter or Space picks an item up, then a Place button on the
  // zone you want drops it. Dragging with a pointer works as before.
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const feedbackRef = useFocusOnResult<HTMLDivElement>(result === true);
  // Picking an item up moves focus to the first Place button, so a keyboard or
  // screen-reader user doesn't have to Tab past every other item to reach it.
  useEffect(() => {
    if (picked) rootRef.current?.querySelector<HTMLElement>('.dd-place')?.focus({ preventScroll: true });
  }, [picked]);

  const move = (itemId: string, zone: string) => {
    if (result === true || locked) return;
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
    const targetIdx = (tid: string) => props.targets.findIndex((t) => t.id === tid);
    const pairs = (get: (i: (typeof props.items)[number]) => string | undefined): [number, number][] =>
      props.items.flatMap((item, s) => {
        const t = targetIdx(get(item) ?? '');
        return t >= 0 ? [[s, t] as [number, number]] : [];
      });
    const text = props.items
      .map((i) => `${i.text}->${props.targets.find((t) => t.id === placement[i.id])?.label ?? 'unplaced'}`)
      .join('; ');
    runtime.reportInteraction(block.id, text, correct, {
      kind: 'matching',
      description: props.question,
      sources: props.items.map((i) => i.text),
      targets: props.targets.map((t) => t.label),
      learner: pairs((i) => placement[i.id]),
      correct: pairs((i) => i.targetId)
    });
  };

  const reset = () => { setPlacement(Object.fromEntries(props.items.map((i) => [i.id, 'bank']))); setResult(null); };

  const startDrag = (e: React.PointerEvent, itemId: string) => {
    if (result === true || locked || e.button > 0) return;
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

  const zoneLabel = (zone: string) => (zone === 'bank' ? 'the item bank' : props.targets.find((t) => t.id === zone)?.label ?? zone);
  const place = (zone: string) => {
    if (!picked) return;
    const item = props.items.find((i) => i.id === picked);
    const id = picked;
    move(picked, zone);
    setNote(`${item?.text ?? 'Item'} placed in ${zoneLabel(zone)}`);
    setPicked(null);
    // Back to the item, now in its new place.
    window.setTimeout(() => rootRef.current?.querySelector<HTMLElement>(`[data-dd-item="${id}"]`)?.focus({ preventScroll: true }), 30);
  };
  const pickable = result !== true && !locked;
  const renderItem = (i: { id: string; text: string }) => (
    <div
      key={i.id}
      data-dd-item={i.id}
      className={`dd-item${picked === i.id ? ' picked' : ''}`}
      style={{ touchAction: 'none' }}
      role="button"
      tabIndex={pickable ? 0 : -1}
      aria-pressed={picked === i.id}
      aria-label={`${i.text}, in ${zoneLabel(placement[i.id] ?? 'bank')}`}
      onPointerDown={(e) => startDrag(e, i.id)}
      onKeyDown={(e) => {
        if (!pickable || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        const next = picked === i.id ? null : i.id;
        setPicked(next);
        setNote(next ? `${i.text} picked up. Choose a place for it.` : `${i.text} put down.`);
      }}
    >
      {i.text}
    </div>
  );
  const placeButton = (zone: string) =>
    picked && placement[picked] !== zone ? (
      <button type="button" className="dd-place" onClick={() => place(zone)}>Place in {zoneLabel(zone)}</button>
    ) : null;

  return (
    <div className="dd-block live" ref={rootRef} role="group" aria-labelledby={qid} onClick={(e) => e.stopPropagation()}>
      <p className="dd-question" id={qid}>{props.question}</p>
      <div className="sr-only" role="status" aria-live="polite">{note || (result === false ? props.feedbackIncorrect : '')}</div>
      <div className="dd-bank" data-zone="bank">
        {bank.length === 0 ? <span className="dd-bank-empty">All placed</span> : bank.map(renderItem)}
        {placeButton('bank')}
      </div>
      <div className="dd-targets">
        {props.targets.map((t) => (
          <div key={t.id} className="dd-target" data-zone={t.id}>
            <div className="dd-target-label">{t.label}</div>
            {placeButton(t.id)}
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
      {!locked && (result === null || result === false) ? (
        <button className="dd-check" onClick={check} disabled={!allPlaced}>Check</button>
      ) : null}
      {result !== null && (
        <div className={`dd-feedback ${result ? 'correct' : 'incorrect'}`} ref={feedbackRef} tabIndex={-1}>
          <span>{result ? props.feedbackCorrect : props.feedbackIncorrect}</span>
          {!result && !locked && <button className="dd-retry" onClick={reset}>Reset</button>}
          {locked && !result && <p className="attempts-note">No attempts left.</p>}
        </div>
      )}
    </div>
  );
}
