import type { RuntimeRendererProps } from '../blockApi';
import type { AudioProps } from '../../schema/types';

export function AudioRuntime({ block }: RuntimeRendererProps) {
  const props = block.props as AudioProps;
  if (!props.src) return null;
  const timed = Boolean(block.timing);
  // On a timeline the block is a track the slide clock drives (see
  // TimedMedia): it autoplays when its bar is reached, follows seeks, and
  // pauses with the clock - exactly like any other timed object. Narration
  // clips are audible but render no visible element.
  if (timed) {
    return (
      <audio
        src={props.src}
        preload="auto"
        style={{ width: '100%', display: props.hideInPlayer ? 'none' : undefined }}
        controls={!props.hideInPlayer && props.controls}
      />
    );
  }
  // No timeline: a plain player element with its own controls/autoplay.
  return (
    <audio
      src={props.src}
      controls={props.controls}
      autoPlay={props.autoplay}
      style={{ width: '100%' }}
    />
  );
}
