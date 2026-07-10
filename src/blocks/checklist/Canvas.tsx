import type { CanvasRendererProps } from '../blockApi';
import type { ChecklistProps } from '../../schema/types';

export function ChecklistCanvas({ block }: CanvasRendererProps) {
  const props = block.props as ChecklistProps;
  return (
    <div className="cl-block">
      {props.title && <p className="cl-title">{props.title}</p>}
      {props.items.map((it) => (
        <div key={it.id} className="cl-row">
          <span className="cl-box" />
          <span className="cl-text">{it.text}</span>
        </div>
      ))}
    </div>
  );
}
