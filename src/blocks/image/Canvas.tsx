import type { CanvasRendererProps } from '../blockApi';
import type { ImageProps } from '../../schema/types';
import { imageClipPath } from './Runtime';

export function ImageCanvas({ block }: CanvasRendererProps) {
  const props = block.props as ImageProps;
  if (!props.src) {
    return (
      <div className="image-placeholder">
        <span>No image yet</span>
        <span className="image-placeholder-sub">Add a URL or upload in the panel</span>
      </div>
    );
  }
  const clip = imageClipPath(props);
  return (
    <img
      src={props.src}
      alt={props.alt}
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: props.fit, display: 'block', clipPath: clip, WebkitClipPath: clip }}
    />
  );
}
