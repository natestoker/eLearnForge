import type { CanvasRendererProps } from '../blockApi';
import type { MatchingProps } from '../../schema/types';

// Editor preview of a matching interaction: left column of prompts, right
// column of answers. Learners connect them in the player.
export function MatchingCanvas({ block }: CanvasRendererProps) {
  const props = block.props as MatchingProps;
  return (
    <div className="match-block">
      <div className="match-question">{props.question || 'Match the pairs'}</div>
      <div className="match-cols">
        <div className="match-col">
          {props.pairs.map((p) => (
            <div key={p.id} className="match-item left">{p.left || 'Left'}</div>
          ))}
        </div>
        <div className="match-col">
          {props.pairs.map((p) => (
            <div key={p.id} className="match-item right">{p.right || 'Right'}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
