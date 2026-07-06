import { GroupProps } from '../../schema/types';
import { CanvasRendererProps } from '../blockApi';
import { BLOCKS } from '../registry';

export function GroupCanvas({ block }: CanvasRendererProps) {
  const props = block.props as GroupProps;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: 'none' }}>
      {props.blocks.map(child => {
        const def = BLOCKS[child.type];
        if (!def || child.editorHidden) return null;
        return (
          <div
            key={child.id}
            style={{
              position: 'absolute',
              left: child.x,
              top: child.y,
              width: child.w,
              height: child.h,
              pointerEvents: 'none'
            }}
          >
            <def.Canvas block={child} selected={false} onUpdateProps={() => {}} />
          </div>
        );
      })}
    </div>
  );
}
