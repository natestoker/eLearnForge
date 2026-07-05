import type { RuntimeRendererProps } from '../blockApi';
import type { VideoProps } from '../../schema/types';

export function VideoRuntime({ block }: RuntimeRendererProps) {
  const props = block.props as VideoProps;
  if (!props.src) return null;
  return (
    <video
      src={props.src}
      controls={props.controls}
      autoPlay={props.autoplay}
      muted={props.autoplay}
      loop={props.loop}
      playsInline
      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', borderRadius: 8 }}
    />
  );
}
