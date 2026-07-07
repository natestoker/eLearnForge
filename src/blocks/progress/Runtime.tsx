import type { RuntimeRendererProps } from '../blockApi';
import type { ProgressProps } from '../../schema/types';

// Progress fraction 0..1 from either course progress (viewed slides) or a
// 0..100 number variable.
export function progressFraction(props: ProgressProps, runtime?: RuntimeRendererProps['runtime']): number {
  if (props.source === 'variable' && props.variableId && runtime) {
    const raw = Number(runtime.variableById(props.variableId) ?? 0);
    return Math.max(0, Math.min(1, raw / 100));
  }
  if (runtime) {
    const snap = runtime.getResumeState();
    const total = runtime.project.slides.length || 1;
    return Math.max(0, Math.min(1, (snap.viewedSlideIds?.length ?? 0) / total));
  }
  return 0.4; // canvas placeholder
}

export function ProgressView({ props, frac, accent }: { props: ProgressProps; frac: number; accent: string }) {
  const pct = Math.round(frac * 100);
  const color = props.color || accent;
  if (props.shape === 'ring') {
    const r = 34, c = 2 * Math.PI * r;
    return (
      <div className="pw-ring-wrap">
        <svg viewBox="0 0 80 80" className="pw-ring">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(128,128,128,0.25)" strokeWidth="8" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 40 40)" />
        </svg>
        {props.showLabel && <span className="pw-ring-label">{pct}%</span>}
      </div>
    );
  }
  return (
    <div className="pw-bar-wrap">
      <div className="pw-bar-track"><div className="pw-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
      {props.showLabel && <span className="pw-bar-label">{pct}%</span>}
    </div>
  );
}

export function ProgressRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as ProgressProps;
  const accent = runtime.project.player?.accent ?? runtime.project.theme?.accent ?? '#3ddc97';
  return <ProgressView props={props} frac={progressFraction(props, runtime)} accent={accent} />;
}
