import type { CanvasRendererProps } from '../blockApi';
import type { ProgressProps } from '../../schema/types';
import { ProgressView, progressFraction } from './Runtime';

export function ProgressCanvas({ block }: CanvasRendererProps) {
  const props = block.props as ProgressProps;
  return <ProgressView props={props} frac={progressFraction(props)} accent="#3ddc97" />;
}
