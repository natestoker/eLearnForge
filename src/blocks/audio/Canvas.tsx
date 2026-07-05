import type { CanvasRendererProps } from '../blockApi';
import type { AudioProps } from '../../schema/types';
import { useWaveform } from '../../shared/useWaveform';

// A clear, recognizable audio chip on the canvas: speaker glyph, label, and
// the clip's REAL decoded waveform so you can time visuals to the sound. It
// is a normal block - movable, trimmable, triggerable.
export function AudioCanvas({ block }: CanvasRendererProps) {
  const props = block.props as AudioProps;
  const peaks = useWaveform(props.src, 48);
  return (
    <div className="audio-chip">
      <span className="audio-chip-icon">{'\u25B6'}</span>
      <div className="audio-chip-body">
        <span className="audio-chip-label">{props.label || 'Audio'}</span>
        <div className="audio-wave">
          {(peaks ?? PLACEHOLDER).map((h, i) => (
            <span key={i} style={{ height: `${Math.max(8, h * 100)}%` }} />
          ))}
        </div>
      </div>
      {!props.src && <span className="audio-chip-warn">set a source</span>}
      {props.hideInPlayer && <span className="audio-chip-tag">hidden in player</span>}
    </div>
  );
}

// Shown until the real waveform decodes (or when there's no source yet).
const PLACEHOLDER = [0.2, 0.4, 0.7, 0.5, 0.3, 0.6, 0.8, 0.35, 0.2, 0.5, 0.65, 0.3, 0.45, 0.25];
