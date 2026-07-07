import { GroupProps, StyledState } from '../../schema/types';
import { RuntimeRendererProps } from '../blockApi';
import { BLOCKS } from '../registry';
import { shadowStyle } from '../../shared/shadow';

export function GroupRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as GroupProps;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {props.blocks.map(child => {
        const def = BLOCKS[child.type];
        if (!def) return null;
        
        // Show/hide triggers (setState hidden) still apply to group children.
        const isVisible = runtime.isBlockVisible(child.id) && runtime.getBlockState(child.id) !== 'hidden';

        return (
          <div
            key={child.id}
            id={`b-${child.id}`}
            style={{
              position: 'absolute',
              left: child.x,
              top: child.y,
              width: child.w,
              height: child.h,
              opacity: isVisible ? 1 : 0,
              pointerEvents: isVisible ? 'auto' : 'none',
              ...shadowStyle(child)
            }}
          >
            <def.Runtime
              block={child}
              runtime={runtime}
              stateStyle={child.stateStyles?.[runtime.getBlockState(child.id) as StyledState]}
            />
          </div>
        );
      })}
    </div>
  );
}
