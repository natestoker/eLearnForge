import type { BlockType } from '../schema/types';
import type { BlockDefinition } from './blockApi';
import { TextCanvas } from './text/Canvas';
import { TextProperties } from './text/Properties';
import { TextRuntime } from './text/Runtime';
import { ImageCanvas } from './image/Canvas';
import { ImageProperties } from './image/Properties';
import { ImageRuntime } from './image/Runtime';
import { StatementCanvas } from './statement/Canvas';
import { StatementProperties } from './statement/Properties';
import { StatementRuntime } from './statement/Runtime';
import { MultipleChoiceCanvas } from './multipleChoice/Canvas';
import { MultipleChoiceProperties } from './multipleChoice/Properties';
import { MultipleChoiceRuntime } from './multipleChoice/Runtime';
import { ButtonCanvas } from './button/Canvas';
import { ButtonProperties } from './button/Properties';
import { ButtonRuntime } from './button/Runtime';
import { HotspotCanvas } from './hotspot/Canvas';
import { HotspotProperties } from './hotspot/Properties';
import { HotspotRuntime } from './hotspot/Runtime';
import { ShapeCanvas } from './shape/Canvas';
import { ShapeProperties } from './shape/Properties';
import { ShapeRuntime } from './shape/Runtime';
import { VideoCanvas } from './video/Canvas';
import { VideoProperties } from './video/Properties';
import { VideoRuntime } from './video/Runtime';
import { AudioCanvas } from './audio/Canvas';
import { AudioProperties } from './audio/Properties';
import { AudioRuntime } from './audio/Runtime';
import { TextEntryCanvas } from './textEntry/Canvas';
import { TextEntryProperties } from './textEntry/Properties';
import { TextEntryRuntime } from './textEntry/Runtime';
import { CodeCanvas } from './code/Canvas';
import { MatchingCanvas } from './matching/Canvas';
import { MatchingProperties } from './matching/Properties';
import { MatchingRuntime } from './matching/Runtime';
import { CodeProperties } from './code/Properties';
import { CodeRuntime } from './code/Runtime';
import { GroupCanvas } from './group/Canvas';
import { GroupProperties } from './group/Properties';
import { GroupRuntime } from './group/Runtime';

export const BLOCKS: Record<BlockType, BlockDefinition> = {
  text: {
    type: 'text',
    label: 'Text',
    glyph: 'T',
    Canvas: TextCanvas,
    Properties: TextProperties,
    Runtime: TextRuntime
  },
  image: {
    type: 'image',
    label: 'Image',
    glyph: 'IMG',
    Canvas: ImageCanvas,
    Properties: ImageProperties,
    Runtime: ImageRuntime
  },
  statement: {
    type: 'statement',
    label: 'Statement',
    glyph: 'ST',
    Canvas: StatementCanvas,
    Properties: StatementProperties,
    Runtime: StatementRuntime
  },
  multipleChoice: {
    type: 'multipleChoice',
    label: 'Multiple choice',
    glyph: 'MC',
    Canvas: MultipleChoiceCanvas,
    Properties: MultipleChoiceProperties,
    Runtime: MultipleChoiceRuntime
  },
  button: { type: 'button', label: 'Button', glyph: 'BTN', Canvas: ButtonCanvas, Properties: ButtonProperties, Runtime: ButtonRuntime },
  hotspot: { type: 'hotspot', label: 'Hotspot', glyph: 'HS', Canvas: HotspotCanvas, Properties: HotspotProperties, Runtime: HotspotRuntime },
  shape: { type: 'shape', label: 'Shape', glyph: 'SH', Canvas: ShapeCanvas, Properties: ShapeProperties, Runtime: ShapeRuntime },
  video: { type: 'video', label: 'Video', glyph: 'VID', Canvas: VideoCanvas, Properties: VideoProperties, Runtime: VideoRuntime },
  audio: { type: 'audio', label: 'Audio', glyph: 'AUD', Canvas: AudioCanvas, Properties: AudioProperties, Runtime: AudioRuntime },
  textEntry: { type: 'textEntry', label: 'Text entry', glyph: 'TE', Canvas: TextEntryCanvas, Properties: TextEntryProperties, Runtime: TextEntryRuntime },
  code: { type: 'code', label: 'Code', glyph: '</>', Canvas: CodeCanvas, Properties: CodeProperties, Runtime: CodeRuntime },
  matching: { type: 'matching', label: 'Matching', glyph: '\u2194', Canvas: MatchingCanvas, Properties: MatchingProperties, Runtime: MatchingRuntime },
  group: { type: 'group', label: 'Group', glyph: 'GRP', Canvas: GroupCanvas, Properties: GroupProperties, Runtime: GroupRuntime }
};

export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[];
