import type { CanvasRendererProps } from '../blockApi';
import type { ShapeProps } from '../../schema/types';
import { SHAPE_POINTS } from './geometry';

// One SVG renderer shared by canvas and runtime. Non-uniform stretch of a
// 100x100 viewBox matches how PowerPoint scales preset geometry.
export function ShapeSvg({ props }: { props: ShapeProps }) {
  const stroke = props.borderWidth > 0 ? props.borderColor : 'none';
  const common = {
    fill: props.fill,
    stroke,
    strokeWidth: props.borderWidth,
    vectorEffect: 'non-scaling-stroke' as const
  };
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {props.points ? (
        <polygon points={props.points} {...common} />
      ) : (
        <>
          {props.kind === 'rectangle' && <rect x="0" y="0" width="100" height="100" {...common} />}
          {props.kind === 'roundedRectangle' && (
            <rect x="0" y="0" width="100" height="100" rx={Math.min(40, props.cornerRadius)} {...common} />
          )}
          {props.kind === 'ellipse' && <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />}
          {SHAPE_POINTS[props.kind] && <polygon points={SHAPE_POINTS[props.kind]} {...common} />}
        </>
      )}
    </svg>
  );
}

export function ShapeCanvas({ block }: CanvasRendererProps) {
  return <ShapeSvg props={block.props as ShapeProps} />;
}
