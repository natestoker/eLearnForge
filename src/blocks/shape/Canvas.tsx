import type { CanvasRendererProps } from '../blockApi';
import type { ShapeProps } from '../../schema/types';
import { SHAPE_POINTS } from './geometry';

// One SVG renderer shared by canvas and runtime. Non-uniform stretch of a
// 100x100 viewBox matches how PowerPoint scales preset geometry.
export function ShapeSvg({ props }: { props: ShapeProps }) {
  if (props.kind === 'rectangle' || props.kind === 'roundedRectangle') {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundColor: props.fill,
        border: props.borderWidth > 0 ? `${props.borderWidth}px solid ${props.borderColor}` : 'none',
        borderRadius: props.kind === 'roundedRectangle' ? props.cornerRadius : 0,
        boxSizing: 'border-box'
      }} />
    );
  }

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
