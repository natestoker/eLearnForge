import type { CSSProperties } from 'react';
import type { CanvasRendererProps } from '../blockApi';
import type { ButtonProps } from '../../schema/types';

// Black or white text depending on the fill's perceived luminance.
function autoContrast(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#111412';
  const n = parseInt(m[1], 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 140 ? '#111412' : '#ffffff';
}

export function buttonStyle(props: ButtonProps): CSSProperties {
  const solid = props.variant === 'solid';
  const fill = props.fill ?? '#3ddc97';
  const text = props.textColor ?? (solid ? autoContrast(fill) : fill);
  return {
    width: '100%',
    height: '100%',
    fontSize: props.fontSize,
    fontWeight: 600,
    borderRadius: 10,
    border: `2px solid ${fill}`,
    background: solid ? fill : 'transparent',
    color: text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
}

export function ButtonCanvas({ block }: CanvasRendererProps) {
  const props = block.props as ButtonProps;
  return <div style={buttonStyle(props)}>{props.label}</div>;
}
