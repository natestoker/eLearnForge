import type { Block, BlockType } from '../schema/types';

const TYPE_LABEL: Record<BlockType, string> = {
  text: 'Text', image: 'Image', statement: 'Statement', multipleChoice: 'Multiple choice', matching: 'Matching',
  button: 'Button', hotspot: 'Hotspot', shape: 'Shape', video: 'Video', audio: 'Audio',
  textEntry: 'Text entry', code: 'Code', group: 'Group',
  fillBlank: 'Fill in the blank', progress: 'Progress bar', timer: 'Timer',
  dragDrop: 'Drag and drop', tabs: 'Tabs / accordion',
  flashcards: 'Flashcards', sequence: 'Sequence', slider: 'Slider', checklist: 'Checklist',
  varDisplay: 'Score / value'
};

// A block's shown name: the author's label if set, else a humanized type.
export function blockDisplayName(block: Block): string {
  if (block.name && block.name.trim()) return block.name.trim();
  // Audio blocks carry a friendly label in props; use it on bars/canvas.
  if (block.type === 'audio') {
    const label = (block.props as { label?: string }).label;
    if (label && label.trim()) return label.trim();
  }
  return TYPE_LABEL[block.type] ?? block.type;
}
