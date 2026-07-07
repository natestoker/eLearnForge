import type { CanvasRendererProps } from '../blockApi';
import type { TimerProps } from '../../schema/types';

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function TimerCanvas({ block }: CanvasRendererProps) {
  const props = block.props as TimerProps;
  const display = props.mode === 'countdown' ? props.seconds : 0;
  return (
    <div className="timer-block" style={{ fontSize: props.fontSize, color: props.color || undefined }}>
      <span className="timer-value">{fmt(display)}</span>
      <span className="timer-toggle">▶</span>
    </div>
  );
}
