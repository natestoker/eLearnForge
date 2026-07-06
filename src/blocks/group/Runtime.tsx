import { GroupProps, StyledState } from '../../schema/types';
import { RuntimeRendererProps } from '../blockApi';
import { BLOCKS } from '../registry';

export function GroupRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as GroupProps;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {props.blocks.map(child => {
        const def = BLOCKS[child.type];
        if (!def) return null;
        
        // Check if the child is visible
        const isVisible = runtime.isBlockVisible(child.id) && child.initialState !== 'hidden';

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
              // Apply any state styles if the runtime handles it at this level, though usually Runtime renders it
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
