import type { CanvasRendererProps } from '../blockApi';
import type { LineEnd, ShadowSpec, ShapeProps } from '../../schema/types';
import {
  SHAPE_POINTS, SHAPE_PATHS, CALLOUT_BODY, DEFAULT_TAIL,
  calloutPath, pathFromNodes, smoothPathFromPoints
} from './geometry';
import { shadowOffset } from '../../shared/shadow';

// One SVG renderer shared by canvas and runtime. Non-uniform stretch of a
// 100x100 viewBox matches how PowerPoint scales preset geometry.
// Outer shadows are applied by the block wrappers (a CSS drop-shadow that
// follows the silhouette); ShapeSvg only renders INNER shadows, which need
// the geometry itself (an SVG filter).
export function ShapeSvg({ props, w = 100, h = 100, innerShadow }: {
  props: ShapeProps; w?: number; h?: number; innerShadow?: ShadowSpec;
}) {
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
        style={{ display: 'block', overflow: 'visible' }}
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

  const hasCustom = Boolean(props.nodes && props.nodes.length >= 3) || Boolean(props.points);

  if ((props.kind === 'rectangle' || props.kind === 'roundedRectangle') && !hasCustom) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundColor: props.noFill ? 'transparent' : props.fill,
        border: props.borderWidth > 0 ? `${props.borderWidth}px solid ${props.borderColor}` : 'none',
        borderRadius: props.kind === 'roundedRectangle' ? props.cornerRadius : 0,
        boxSizing: 'border-box',
        boxShadow: innerShadow ? innerBoxShadow(innerShadow) : undefined
      }} />
    );
  }

  const stroke = props.borderWidth > 0 ? props.borderColor : 'none';
  const common = {
    fill: props.noFill ? 'none' : props.fill,
    stroke,
    strokeWidth: props.borderWidth,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const
  };

  const filterId = innerShadow ? `is-${Math.abs(hashSpec(innerShadow))}` : null;
  const content = (() => {
    // Custom vector path from the pen tool (nodes with Bezier handles) wins;
    // then the legacy pen polygon; then the preset geometry.
    if (props.nodes && props.nodes.length >= 3) {
      return <path d={pathFromNodes(props.nodes)} {...common} />;
    }
    if (props.points) {
      return props.smooth ? (
        <path d={smoothPathFromPoints(props.points)} {...common} />
      ) : (
        <polygon points={props.points} {...common} />
      );
    }
    // Callouts are one closed parametric path: the body boundary with the
    // tail spliced in, so the outline is seamless and effects (wipe, inner
    // shadow) treat it like any other shape.
    if (CALLOUT_BODY[props.kind]) {
      return <path d={calloutPath(props.kind, props.tail ?? DEFAULT_TAIL)} {...common} />;
    }
    return (
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
    );
  })();

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {innerShadow && filterId && <defs>{innerShadowFilter(filterId, innerShadow, w, h)}</defs>}
      {filterId ? <g filter={`url(#${filterId})`}>{content}</g> : content}
    </svg>
  );
}

function innerBoxShadow(s: ShadowSpec): string {
  const { dx, dy } = shadowOffset(s);
  return `inset ${dx.toFixed(1)}px ${dy.toFixed(1)}px ${s.blur}px ${s.spread ?? 0}px ${rgba(s)}`;
}

const rgba = (s: ShadowSpec) => {
  const n = parseInt(s.color.replace('#', '') || '0', 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${s.opacity})`;
};

const hashSpec = (s: ShadowSpec) => {
  const str = `${s.color}|${s.opacity}|${s.blur}|${s.distance}|${s.angle}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
};

// Classic inner shadow as an SVG filter: invert the alpha, blur, offset,
// tint, then composite back inside the source. Blur/offset are given in px
// but the viewBox is 100x100 stretched to the block, so both convert
// through the block size per axis.
function innerShadowFilter(id: string, s: ShadowSpec, w: number, h: number) {
  const { dx, dy } = shadowOffset(s);
  const sx = 100 / Math.max(1, w);
  const sy = 100 / Math.max(1, h);
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      <feComponentTransfer in="SourceAlpha">
        <feFuncA type="table" tableValues="1 0" />
      </feComponentTransfer>
      <feGaussianBlur stdDeviation={`${(s.blur / 2) * sx} ${(s.blur / 2) * sy}`} />
      <feOffset dx={dx * sx} dy={dy * sy} result="inv" />
      <feFlood floodColor={s.color} floodOpacity={s.opacity} />
      <feComposite in2="inv" operator="in" />
      <feComposite in2="SourceAlpha" operator="in" result="shadow" />
      <feMerge>
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="shadow" />
      </feMerge>
    </filter>
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
  const shadow = block.shadow;
  return (
    <ShapeSvg
      props={block.props as ShapeProps}
      w={block.w}
      h={block.h}
      innerShadow={shadow?.inner ? shadow : undefined}
    />
  );
}
