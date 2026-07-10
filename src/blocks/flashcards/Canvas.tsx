import type { CanvasRendererProps } from '../blockApi';
import type { FlashcardsProps } from '../../schema/types';

export function FlashcardsCanvas({ block }: CanvasRendererProps) {
  const props = block.props as FlashcardsProps;
  return (
    <div className="fc-block" style={{ gridTemplateColumns: `repeat(${props.columns}, 1fr)` }}>
      {props.cards.map((c) => (
        <div key={c.id} className="fc-card">
          <div className="fc-face front">{c.front}</div>
        </div>
      ))}
    </div>
  );
}
