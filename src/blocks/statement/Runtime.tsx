import type { RuntimeRendererProps } from '../blockApi';
import type { StatementProps } from '../../schema/types';

export function StatementRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as StatementProps;
  const hasClick = runtime.blockHasClickTrigger(block.id);
  return (
    <div className="statement-block">
      {props.imageSrc && (
        <img className="statement-image" src={props.imageSrc} alt="" draggable={false} />
      )}
      <h2 className="statement-heading">{props.heading}</h2>
      <p className="statement-body">{props.body}</p>
      <button
        className="statement-continue live"
        onClick={(e) => {
          e.stopPropagation();
          runtime.clickBlock(block.id);
        }}
        title={hasClick ? 'Continue' : 'No trigger wired to this block yet'}
      >
        Continue <span className="chev">&rsaquo;</span>
      </button>
    </div>
  );
}
