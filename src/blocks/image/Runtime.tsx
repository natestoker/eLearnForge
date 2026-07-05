import type { RuntimeRendererProps } from '../blockApi';
import type { ImageProps } from '../../schema/types';
import { clipPathForKind, pointsToClipPath } from '../shape/geometry';

// Resolve the CSS clip-path for an image: a custom pen-drawn polygon wins,
// then a preset shape kind. Rectangle/none => no clip.
export function imageClipPath(props: ImageProps): string | undefined {
  if (props.clipPoints) return pointsToClipPath(props.clipPoints);
  if (props.clipKind) return clipPathForKind(props.clipKind) ?? undefined;
  return undefined;
}

export function ImageRuntime({ block }: RuntimeRendererProps) {
  const props = block.props as ImageProps;
  if (!props.src) return null;
  return (
    <img
      src={props.src}
      alt={props.alt}
      draggable={false}
      style={{
        width: '100%', height: '100%', objectFit: props.fit, display: 'block',
        clipPath: imageClipPath(props),
        WebkitClipPath: imageClipPath(props)
      }}
    />
  );
}
