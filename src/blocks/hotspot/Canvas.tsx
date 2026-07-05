import type { CanvasRendererProps } from '../blockApi';
import type { HotspotProps } from '../../schema/types';

// Authors need to see hotspots; learners usually should not.
export function HotspotCanvas({ block }: CanvasRendererProps) {
  const props = block.props as HotspotProps;
  return (
    <div className="hotspot-canvas">
      <span>HOTSPOT{props.showHint ? ' (hint on)' : ''}</span>
    </div>
  );
}
