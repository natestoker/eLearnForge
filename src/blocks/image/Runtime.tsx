import { useId } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { ImageProps } from '../../schema/types';
import { clipPathForKind, pathFromNodes, pointsToClipPath } from '../shape/geometry';

// Resolve the CSS clip-path for an image: a custom pen-drawn polygon wins,
// then a preset shape kind. Rectangle/none => no clip. (Vector clipNodes
// paths render through an SVG clipPath instead - see ClippedImage.)
export function imageClipPath(props: ImageProps): string | undefined {
  if (props.clipPoints) return pointsToClipPath(props.clipPoints);
  if (props.clipKind) return clipPathForKind(props.clipKind) ?? undefined;
  return undefined;
}

// The one image renderer for editor and player. Custom vector clips
// (ImageProps.clipNodes, from the shared pen engine) need real Bezier
// support, which CSS polygon() lacks - so they clip through an inline SVG
// clipPath in objectBoundingBox units (scales with the block, like
// PowerPoint geometry). Straight-edge presets keep the cheap CSS path.
export function ClippedImage({ props }: { props: ImageProps }) {
  const uid = useId();
  const clipId = `efclip-${uid.replace(/[:]/g, '')}`;
  const hasNodes = Boolean(props.clipNodes && props.clipNodes.length >= 3);
  const clip = hasNodes ? `url(#${clipId})` : imageClipPath(props);
  return (
    <>
      {hasNodes && (
        <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden focusable="false">
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              {/* Nodes live in 0..100; objectBoundingBox wants 0..1. */}
              <path d={pathFromNodes(props.clipNodes!)} transform="scale(0.01)" />
            </clipPath>
          </defs>
        </svg>
      )}
      <img
        src={props.src}
        alt={props.alt}
        draggable={false}
        style={{
          width: '100%', height: '100%', objectFit: props.fit, display: 'block',
          clipPath: clip,
          WebkitClipPath: clip
        }}
      />
    </>
  );
}

export function ImageRuntime({ block }: RuntimeRendererProps) {
  const props = block.props as ImageProps;
  if (!props.src) return null;
  return <ClippedImage props={props} />;
}
