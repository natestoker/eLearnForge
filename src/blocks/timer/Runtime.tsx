import { useEffect, useRef, useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { TimerProps } from '../../schema/types';
import { timerDoneVariableName } from '../../schema/factory';

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function TimerRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as TimerProps;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(props.autoStart);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const remaining = props.mode === 'countdown' ? props.seconds - elapsed : elapsed;

  // Countdown hitting zero sets timer_{blockId}_done and stops.
  useEffect(() => {
    if (props.mode === 'countdown' && remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      setRunning(false);
      runtime.setVariableByName(timerDoneVariableName(block.id), true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, props.mode]);

  const display = props.mode === 'countdown' ? Math.max(0, remaining) : elapsed;
  return (
    <div className="timer-block live" style={{ fontSize: props.fontSize, color: props.color || undefined }} onClick={(e) => e.stopPropagation()}>
      <span className="timer-value">{fmt(display)}</span>
      <button className="timer-toggle" onClick={() => setRunning((r) => !r)} title={running ? 'Pause' : 'Start'}>
        {running ? '❚❚' : '▶'}
      </button>
    </div>
  );
}
