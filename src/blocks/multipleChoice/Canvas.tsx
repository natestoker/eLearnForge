import type { CanvasRendererProps } from '../blockApi';
import type { MultipleChoiceProps } from '../../schema/types';

export function MultipleChoiceCanvas({ block }: CanvasRendererProps) {
  const props = block.props as MultipleChoiceProps;
  return (
    <div className="mc-block">
      <p className="mc-question">{props.question}</p>
      <div className="mc-choices">
        {props.choices.map((c) => (
          <div key={c.id} className="mc-choice">
            <span className={`mc-mark ${props.allowMultiple ? 'square' : 'round'}`} />
            <span className="mc-choice-text">{c.text}</span>
            {props.correctChoiceIds.includes(c.id) && (
              <span className="mc-correct-tag" title="Correct answer (authoring only)">correct</span>
            )}
          </div>
        ))}
      </div>
      <div className="mc-submit" aria-hidden="true">Submit</div>
    </div>
  );
}
