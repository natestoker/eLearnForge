import { useUiStore } from '../state/uiStore';

// Drag handles between panels. Pointer capture keeps the gesture alive
// when the cursor outruns the 6px handle; sizes persist via the ui store.

const LIMITS: Record<'left' | 'right' | 'timeline', [number, number]> = {
  left: [160, 420],
  right: [240, 520],
  timeline: [100, 360]
};

export function Splitter({ target }: { target: 'left' | 'right' | 'timeline' }) {
  const setPanelSize = useUiStore((s) => s.setPanelSize);
  const horizontal = target === 'timeline';

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const startPos = horizontal ? e.clientY : e.clientX;
    const startSize = useUiStore.getState().panelSizes[target];
    const [min, max] = LIMITS[target];
    const onMove = (ev: PointerEvent) => {
      const pos = horizontal ? ev.clientY : ev.clientX;
      // left grows rightward; right and timeline grow toward the center.
      const delta = target === 'left' ? pos - startPos : startPos - pos;
      setPanelSize(target, Math.max(min, Math.min(max, startSize + delta)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className={`splitter ${horizontal ? 'splitter-h' : 'splitter-v'}`}
      onPointerDown={onDown}
      role="separator"
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
    />
  );
}
