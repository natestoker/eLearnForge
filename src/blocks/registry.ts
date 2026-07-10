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
import { FillBlankCanvas } from './fillBlank/Canvas';
import { FillBlankProperties } from './fillBlank/Properties';
import { FillBlankRuntime } from './fillBlank/Runtime';
import { ProgressCanvas } from './progress/Canvas';
import { ProgressProperties } from './progress/Properties';
import { ProgressRuntime } from './progress/Runtime';
import { TimerCanvas } from './timer/Canvas';
import { TimerProperties } from './timer/Properties';
import { TimerRuntime } from './timer/Runtime';
import { DragDropCanvas } from './dragDrop/Canvas';
import { DragDropProperties } from './dragDrop/Properties';
import { DragDropRuntime } from './dragDrop/Runtime';
import { TabsCanvas } from './tabs/Canvas';
import { TabsProperties } from './tabs/Properties';
import { TabsRuntime } from './tabs/Runtime';
import { FlashcardsCanvas } from './flashcards/Canvas';
import { FlashcardsProperties } from './flashcards/Properties';
import { FlashcardsRuntime } from './flashcards/Runtime';
import { SequenceCanvas } from './sequence/Canvas';
import { SequenceProperties } from './sequence/Properties';
import { SequenceRuntime } from './sequence/Runtime';
import { SliderCanvas } from './slider/Canvas';
import { SliderProperties } from './slider/Properties';
import { SliderRuntime } from './slider/Runtime';
import { ChecklistCanvas } from './checklist/Canvas';
import { ChecklistProperties } from './checklist/Properties';
import { ChecklistRuntime } from './checklist/Runtime';
import { VarDisplayCanvas } from './varDisplay/Canvas';
import { VarDisplayProperties } from './varDisplay/Properties';
import { VarDisplayRuntime } from './varDisplay/Runtime';
import { LabeledGraphicCanvas } from './labeledGraphic/Canvas';
import { LabeledGraphicProperties } from './labeledGraphic/Properties';
import { LabeledGraphicRuntime } from './labeledGraphic/Runtime';
import { ScenarioCanvas } from './scenario/Canvas';
import { ScenarioProperties } from './scenario/Properties';
import { ScenarioRuntime } from './scenario/Runtime';

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
  group: { type: 'group', label: 'Group', glyph: 'GRP', Canvas: GroupCanvas, Properties: GroupProperties, Runtime: GroupRuntime },
  fillBlank: { type: 'fillBlank', label: 'Fill in the blank', glyph: 'FIB', Canvas: FillBlankCanvas, Properties: FillBlankProperties, Runtime: FillBlankRuntime },
  progress: { type: 'progress', label: 'Progress bar', glyph: '\u2593', Canvas: ProgressCanvas, Properties: ProgressProperties, Runtime: ProgressRuntime },
  timer: { type: 'timer', label: 'Timer', glyph: '\u23f1', Canvas: TimerCanvas, Properties: TimerProperties, Runtime: TimerRuntime },
  dragDrop: { type: 'dragDrop', label: 'Drag and drop', glyph: 'DND', Canvas: DragDropCanvas, Properties: DragDropProperties, Runtime: DragDropRuntime },
  tabs: { type: 'tabs', label: 'Tabs / accordion', glyph: '⊟', Canvas: TabsCanvas, Properties: TabsProperties, Runtime: TabsRuntime },
  flashcards: { type: 'flashcards', label: 'Flashcards', glyph: 'FC', Canvas: FlashcardsCanvas, Properties: FlashcardsProperties, Runtime: FlashcardsRuntime },
  sequence: { type: 'sequence', label: 'Sequence', glyph: '123', Canvas: SequenceCanvas, Properties: SequenceProperties, Runtime: SequenceRuntime },
  slider: { type: 'slider', label: 'Slider', glyph: 'SLD', Canvas: SliderCanvas, Properties: SliderProperties, Runtime: SliderRuntime },
  checklist: { type: 'checklist', label: 'Checklist', glyph: 'CL', Canvas: ChecklistCanvas, Properties: ChecklistProperties, Runtime: ChecklistRuntime },
  varDisplay: { type: 'varDisplay', label: 'Score / value', glyph: '%', Canvas: VarDisplayCanvas, Properties: VarDisplayProperties, Runtime: VarDisplayRuntime },
  labeledGraphic: { type: 'labeledGraphic', label: 'Labeled graphic', glyph: 'LG', Canvas: LabeledGraphicCanvas, Properties: LabeledGraphicProperties, Runtime: LabeledGraphicRuntime },
  scenario: { type: 'scenario', label: 'Scenario', glyph: 'SC', Canvas: ScenarioCanvas, Properties: ScenarioProperties, Runtime: ScenarioRuntime }
};

export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[];
