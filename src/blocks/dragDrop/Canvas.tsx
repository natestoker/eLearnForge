import type { CanvasRendererProps } from '../blockApi';
import type { DragDropProps } from '../../schema/types';

export function DragDropCanvas({ block }: CanvasRendererProps) {
  const props = block.props as DragDropProps;
  return (
    <div className="dd-block">
      <p className="dd-question">{props.question}</p>
      <div className="dd-bank">
        {props.items.map((i) => <div key={i.id} className="dd-item">{i.text}</div>)}
      </div>
      <div className="dd-targets">
        {props.targets.map((t) => (
          <div key={t.id} className="dd-target">
            <div className="dd-target-label">{t.label}</div>
            <div className="dd-target-items" />
          </div>
        ))}
      </div>
    </div>
  );
}
