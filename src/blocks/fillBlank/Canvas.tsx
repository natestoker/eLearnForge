import type { CanvasRendererProps } from '../blockApi';
import type { FillBlankProps } from '../../schema/types';

export function FillBlankCanvas({ block }: CanvasRendererProps) {
  const props = block.props as FillBlankProps;
  const parts = props.question.split('___');
  return (
    <div className="fb-block" style={{ fontSize: props.fontSize }}>
      <p className="fb-question">
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && <span className="fb-blank-slot" />}
          </span>
        ))}
      </p>
      <div className="fb-row">
        <input className="fb-input" disabled placeholder="answer" />
        <button className="fb-check" disabled>Check</button>
      </div>
    </div>
  );
}
