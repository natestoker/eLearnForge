import type { CanvasRendererProps } from '../blockApi';
import type { TextEntryProps } from '../../schema/types';

export function TextEntryCanvas({ block }: CanvasRendererProps) {
  const props = block.props as TextEntryProps;
  return (
    <div className="text-entry-canvas" style={{ fontSize: props.fontSize }}>
      {props.placeholder || 'Text entry'}
    </div>
  );
}
