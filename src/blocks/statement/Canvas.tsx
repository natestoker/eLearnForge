import type { CanvasRendererProps } from '../blockApi';
import type { StatementProps } from '../../schema/types';

export function StatementCanvas({ block }: CanvasRendererProps) {
  const props = block.props as StatementProps;
  return (
    <div className="statement-block">
      {props.imageSrc && (
        <img className="statement-image" src={props.imageSrc} alt="" draggable={false} />
      )}
      <h2 className="statement-heading">{props.heading}</h2>
      <p className="statement-body">{props.body}</p>
      <div className="statement-continue" aria-hidden="true">
        Continue <span className="chev">&rsaquo;</span>
      </div>
    </div>
  );
}
