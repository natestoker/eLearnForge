import type { CanvasRendererProps } from '../blockApi';
import type { SequenceProps } from '../../schema/types';

export function SequenceCanvas({ block }: CanvasRendererProps) {
  const props = block.props as SequenceProps;
  return (
    <div className="seq-block">
      <p className="seq-question">{props.question}</p>
      {props.items.map((it, i) => (
        <div key={it.id} className="seq-row">
          <span className="seq-num">{i + 1}</span>
          <span className="seq-text">{it.text}</span>
        </div>
      ))}
    </div>
  );
}
