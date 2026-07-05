import type { FC } from 'react';
import type { Block, BlockType, StateStyle } from '../schema/types';
import type { Runtime } from '../engine/runtime';

// Each block type ships three renderers in separate files (per the brief):
//   Canvas     - how it looks on the authoring canvas
//   Properties - how you edit its props
//   Runtime    - how it looks/behaves in preview/play mode
// This separation is what lets the library grow.

export type UpdateProps = (fn: (props: any) => void, history?: boolean) => void;

export interface CanvasRendererProps {
  block: Block;
  selected: boolean;
  onUpdateProps: UpdateProps;
}

export interface PropertiesRendererProps {
  block: Block;
  onUpdateProps: UpdateProps;
}

export interface RuntimeRendererProps {
  block: Block;
  stateStyle?: StateStyle;
  runtime: Runtime;
  // Current timeline time (undefined when the slide has no timeline). Blocks
  // that animate their own content use this to stay stateless, so scrubbing
  // the seekbar reverses them like any other timeline state.
  t?: number;
  tState?: { present: boolean; opacity: number } | null;
}

export interface BlockDefinition {
  type: BlockType;
  label: string;
  glyph: string; // toolbar glyph, deliberately plain ASCII-adjacent
  Canvas: FC<CanvasRendererProps>;
  Properties: FC<PropertiesRendererProps>;
  Runtime: FC<RuntimeRendererProps>;
}
