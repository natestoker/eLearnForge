import type { CanvasRendererProps } from '../blockApi';
import type { VideoProps } from '../../schema/types';

export function VideoCanvas({ block }: CanvasRendererProps) {
  const props = block.props as VideoProps;
  if (!props.src) {
    return <div className="media-placeholder">VIDEO - set a source in Properties</div>;
  }
  // Muted, no controls on the canvas: authors position it, learners play it.
  return <video src={props.src} muted style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />;
}
