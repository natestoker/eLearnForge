import type { CanvasRendererProps } from '../blockApi';
import type { VideoProps } from '../../schema/types';

export function VideoCanvas({ block }: CanvasRendererProps) {
  const props = block.props as VideoProps;
  if (!props.src) {
    return <div className="media-placeholder">VIDEO - set a source in Properties</div>;
  }
  // Muted, no controls on the canvas: authors position it, learners play it.
  // Show the poster still if set, so the canvas matches the player's first frame.
  return <video src={props.src} poster={props.poster || undefined} muted style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />;
}
