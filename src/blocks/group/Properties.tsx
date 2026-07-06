import { GroupProps } from '../../schema/types';
import { PropertiesRendererProps } from '../blockApi';

export function GroupProperties({ block }: PropertiesRendererProps) {
  const props = block.props as GroupProps;
  return (
    <div className="props-group">
      <div className="props-row">
        <label>Items in Group</label>
        <div>{props.blocks.length} blocks</div>
      </div>
    </div>
  );
}
