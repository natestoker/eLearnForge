import type { CanvasRendererProps } from '../blockApi';
import type { ScenarioProps } from '../../schema/types';

export function ScenarioCanvas({ block }: CanvasRendererProps) {
  const props = block.props as ScenarioProps;
  const start = props.passages[0];
  if (!start) return <div className="sc-block" />;
  return (
    <div className="sc-block">
      {start.speaker && <span className="sc-speaker">{start.speaker}</span>}
      <p className="sc-text">{start.text}</p>
      <div className="sc-choices">
        {start.choices.map((c) => (
          <div key={c.id} className="sc-choice">{c.label}</div>
        ))}
      </div>
    </div>
  );
}
