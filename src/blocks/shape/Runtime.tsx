import type { RuntimeRendererProps } from '../blockApi';
import type { ShapeProps } from '../../schema/types';
import { ShapeSvg } from './Canvas';

export function ShapeRuntime({ block, stateStyle }: RuntimeRendererProps) {
  const base = block.props as ShapeProps;
  const props = stateStyle
    ? { ...base, fill: stateStyle.fill ?? base.fill, borderColor: stateStyle.borderColor ?? base.borderColor }
    : base;
  return <ShapeSvg props={props} w={block.w} h={block.h} />;
}
