import type { RuntimeRendererProps } from '../blockApi';
import type { ButtonProps } from '../../schema/types';
import { buttonStyle } from './Canvas';

// The player wrapper owns the click (runtime.clickBlock). The button is
// purely visual so the whole hit area matches the block bounds.
export function ButtonRuntime({ block, stateStyle }: RuntimeRendererProps) {
  const base = block.props as ButtonProps;
  const props = stateStyle
    ? { ...base, fill: stateStyle.fill ?? base.fill, textColor: stateStyle.textColor ?? base.textColor }
    : base;
  return <div style={buttonStyle(props)}>{props.label}</div>;
}
