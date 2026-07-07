import type { CanvasRendererProps } from '../blockApi';
import type { TabsProps } from '../../schema/types';
import { TabsView } from './Runtime';

export function TabsCanvas({ block }: CanvasRendererProps) {
  return <TabsView props={block.props as TabsProps} accent="#3ddc97" />;
}
