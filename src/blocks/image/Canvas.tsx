import type { CanvasRendererProps } from '../blockApi';
import type { ImageProps } from '../../schema/types';
import { ClippedImage } from './Runtime';

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
  return <ClippedImage props={props} />;
}
