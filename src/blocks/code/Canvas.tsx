import type { CanvasRendererProps } from '../blockApi';
import type { CodeProps } from '../../schema/types';

// Authored JS never executes on the canvas: authoring stays stable and
// predictable. The canvas shows a static summary; Preview runs it live.
export function CodeCanvas({ block }: CanvasRendererProps) {
  const props = block.props as CodeProps;
  const firstLine = (props.html || props.js || '').split('\n')[0].slice(0, 48);
  return (
    <div className="code-canvas">
      <span className="code-canvas-tag">CODE</span>
      <code>{firstLine || 'empty code block'}</code>
      <span className="code-canvas-hint">runs in Preview and published output</span>
    </div>
  );
}
