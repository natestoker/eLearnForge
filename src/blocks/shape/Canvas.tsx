import type { CanvasRendererProps } from '../blockApi';
import type { LineEnd, ShapeProps } from '../../schema/types';
import {
  SHAPE_POINTS, SHAPE_PATHS, CALLOUT_BODY, DEFAULT_TAIL,
  calloutTailTriangle, smoothPathFromPoints
} from './geometry';

// One SVG renderer shared by canvas and runtime. Non-uniform stretch of a
// 100x100 viewBox matches how PowerPoint scales preset geometry.
export function ShapeSvg({ props, w = 100, h = 100 }: { props: ShapeProps; w?: number; h?: number }) {
  if (props.isLine) {
    const stroke = props.borderColor || '#1c222b';
    const strokeWidth = props.borderWidth || 2;
    const pointsStr = props.points || '0,0 100,100';
    const pts = pointsStr.split(' ').map((p) => p.split(',').map(Number));
    const [[rx1, ry1], [rx2, ry2]] = pts;

    const x1 = (rx1 * w) / 100;
    const y1 = (ry1 * h) / 100;
    const x2 = (rx2 * w) / 100;
    const y2 = (ry2 * h) / 100;

    // PowerPoint-style ends: lineStart/lineEnd carry type + size. Legacy
    // projects stored only arrow: start|end|both (a medium triangle).
    const legacy = props.arrow || 'none';
    const start: LineEnd | undefined =
      props.lineStart ?? (legacy === 'start' || legacy === 'both' ? { type: 'triangle' } : undefined);
    const end: LineEnd | undefined =
      props.lineEnd ?? (legacy === 'end' || legacy === 'both' ? { type: 'triangle' } : undefined);

    const startMarker = lineEndMarker(start, stroke, 'start');
    const endMarker = lineEndMarker(end, stroke, 'end');

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
          {startMarker?.def}
          {endMarker?.def}
        </defs>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          markerStart={startMarker ? `url(#${startMarker.id})` : undefined}
          markerEnd={endMarker ? `url(#${endMarker.id})` : undefined}
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

  // Callouts are parametric: a body (top 70% of the shape space) plus a
  // tail triangle to a draggable tip. Draw order makes the outline read as
  // one continuous shape: body with its border, then the tail fill (covers
  // the border segment the tail crosses), then only the tail's two side
  // edges stroked.
  const calloutBody = CALLOUT_BODY[props.kind];
  if (calloutBody && !props.points) {
    const tip = props.tail ?? DEFAULT_TAIL;
    const tail = calloutTailTriangle(props.kind, tip);
    const body =
      calloutBody === 'ellipse'
        ? <ellipse cx="50" cy="35" rx="50" ry="35" {...common} />
        : <rect x="0" y="0" width="100" height="70" rx={calloutBody === 'roundRect' ? 12 : 0} {...common} />;
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible', filter: props.shadow ? 'drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.15))' : undefined }}>
        {body}
        {tail && (
          <>
            <polygon
              points={`${tail.base1[0]},${tail.base1[1]} ${tail.base2[0]},${tail.base2[1]} ${tail.tip[0]},${tail.tip[1]}`}
              fill={props.fill}
            />
            {stroke !== 'none' && (
              <path
                d={`M ${tail.base1[0]},${tail.base1[1]} L ${tail.tip[0]},${tail.tip[1]} L ${tail.base2[0]},${tail.base2[1]}`}
                fill="none"
                stroke={stroke}
                strokeWidth={props.borderWidth}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </>
        )}
      </svg>
    );
  }

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
        props.smooth ? (
          <path d={smoothPathFromPoints(props.points)} {...common} />
        ) : (
          <polygon points={props.points} {...common} />
        )
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

// One SVG marker per line end. markerUnits defaults to strokeWidth, so like
// PowerPoint the head scales with the line's width; size sm/md/lg multiplies
// that. Start markers use orient=auto-start-reverse so they point outward.
const END_SCALE = { sm: 2.5, md: 4, lg: 6 } as const;
function lineEndMarker(end: LineEnd | undefined, stroke: string, at: 'start' | 'end'):
  { id: string; def: JSX.Element } | null {
  if (!end || end.type === 'none') return null;
  const size = END_SCALE[end.size ?? 'md'];
  const id = `le-${at}-${end.type}-${end.size ?? 'md'}-${stroke.replace('#', '')}`;
  const shape =
    end.type === 'triangle' ? <path d="M0,0 L10,5 L0,10 Z" fill={stroke} />
    : end.type === 'stealth' ? <path d="M0,0 L10,5 L0,10 L3.5,5 Z" fill={stroke} />
    : end.type === 'open' ? <path d="M1,1 L9,5 L1,9" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    : end.type === 'oval' ? <circle cx="5" cy="5" r="4" fill={stroke} />
    : <path d="M5,0 L10,5 L5,10 L0,5 Z" fill={stroke} />; // diamond
  return {
    id,
    def: (
      <marker
        key={id}
        id={id}
        viewBox="0 0 10 10"
        markerWidth={size}
        markerHeight={size}
        refX={end.type === 'oval' || end.type === 'diamond' ? 5 : 8.5}
        refY={5}
        orient={at === 'start' ? 'auto-start-reverse' : 'auto'}
      >
        {shape}
      </marker>
    )
  };
}

export function ShapeCanvas({ block }: CanvasRendererProps) {
  return <ShapeSvg props={block.props as ShapeProps} w={block.w} h={block.h} />;
}
