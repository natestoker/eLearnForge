import type { CanvasRendererProps } from '../blockApi';
import type { ShapeProps } from '../../schema/types';
import { SHAPE_POINTS, SHAPE_PATHS } from './geometry';

// One SVG renderer shared by canvas and runtime. Non-uniform stretch of a
// 100x100 viewBox matches how PowerPoint scales preset geometry.
export function ShapeSvg({ props, w = 100, h = 100 }: { props: ShapeProps; w?: number; h?: number }) {
  if (props.isLine) {
    const stroke = props.borderColor || '#1c222b';
    const strokeWidth = props.borderWidth || 2;
    const arrow = props.arrow || 'none';
    const pointsStr = props.points || '0,0 100,100';
    const pts = pointsStr.split(' ').map((p) => p.split(',').map(Number));
    const [[rx1, ry1], [rx2, ry2]] = pts;
    
    const x1 = (rx1 * w) / 100;
    const y1 = (ry1 * h) / 100;
    const x2 = (rx2 * w) / 100;
    const y2 = (ry2 * h) / 100;
    
    // Unique ID for the arrow marker to avoid conflicts
    const markerId = `arrow-${stroke.replace('#', '')}-${strokeWidth}`;
    
    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        style={{
          display: 'block',
          overflow: 'visible',
          filter: props.shadow ? 'drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.15))' : undefined
        }}
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0,1 L7,4 L0,7 Z" fill={stroke} />
          </marker>
        </defs>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          markerStart={arrow === 'start' || arrow === 'both' ? `url(#${markerId})` : undefined}
          markerEnd={arrow === 'end' || arrow === 'both' ? `url(#${markerId})` : undefined}
        />
      </svg>
    );
  }

  if (props.kind === 'rectangle' || props.kind === 'roundedRectangle') {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundColor: props.fill,
        border: props.borderWidth > 0 ? `${props.borderWidth}px solid ${props.borderColor}` : 'none',
        borderRadius: props.kind === 'roundedRectangle' ? props.cornerRadius : 0,
        boxSizing: 'border-box',
        boxShadow: props.shadow ? '0 10px 30px rgba(0, 0, 0, 0.08), 0 1px 8px rgba(0, 0, 0, 0.04)' : undefined
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
      style={{
        display: 'block',
        overflow: 'visible',
        filter: props.shadow ? 'drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.15))' : undefined
      }}
    >
      {props.points ? (
        <polygon points={props.points} {...common} />
      ) : (
        <>
          {props.kind === 'ellipse' && <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />}
          {SHAPE_POINTS[props.kind] && <polygon points={SHAPE_POINTS[props.kind]} {...common} />}
          {SHAPE_PATHS[props.kind] && (
            <path
              d={SHAPE_PATHS[props.kind]}
              fillRule={props.kind === 'smileyFace' ? 'evenodd' : undefined}
              {...common}
            />
          )}
        </>
      )}
    </svg>
  );
}

export function ShapeCanvas({ block }: CanvasRendererProps) {
  return <ShapeSvg props={block.props as ShapeProps} w={block.w} h={block.h} />;
}
