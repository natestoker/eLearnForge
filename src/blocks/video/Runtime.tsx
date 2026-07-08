import type { RuntimeRendererProps } from '../blockApi';
import type { VideoProps } from '../../schema/types';
import { useVttUrl } from './useVttUrl';

export function VideoRuntime({ block }: RuntimeRendererProps) {
  const props = block.props as VideoProps;
  const vttUrl = useVttUrl(props.captionsVtt);
  if (!props.src) return null;
  return (
    <video
      src={props.src}
      poster={props.poster || undefined}
      controls={props.controls}
      autoPlay={props.autoplay}
      muted={props.autoplay}
      loop={props.loop}
      playsInline
      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', borderRadius: 8 }}
    >
      {vttUrl && (
        <track
          default
          kind="captions"
          src={vttUrl}
          srcLang={props.captionsLang || 'en'}
          label={props.captionsLabel || 'Captions'}
        />
      )}
    </video>
  );
}
