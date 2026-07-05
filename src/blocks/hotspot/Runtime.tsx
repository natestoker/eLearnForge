import type { RuntimeRendererProps } from '../blockApi';
import type { HotspotProps } from '../../schema/types';

export function HotspotRuntime({ block }: RuntimeRendererProps) {
  const props = block.props as HotspotProps;
  return (
    <div
      className={`hotspot-runtime ${props.showHint ? 'hint' : ''}`}
      title={props.tooltip || undefined}
    />
  );
}
