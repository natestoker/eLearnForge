import type { Block } from '../schema/types';

// Natural text a block carries, used for the default "expose only if it has
// text" rule and as the announced name when no explicit label is set.
export function blockText(block: Block): string {
  const p = block.props as unknown as Record<string, unknown>;
  if (block.type === 'text') {
    const div = document.createElement('div');
    div.innerHTML = String(p.html ?? '');
    return (div.textContent ?? '').trim();
  }
  if (block.type === 'image') return String(p.alt ?? '').trim();
  if (block.type === 'button') return String(p.label ?? '').trim();
  // A statement's words are its heading and body (there is no `text` prop):
  // reading the wrong field hid every statement from screen readers.
  if (block.type === 'statement') return [p.heading, p.body, p.text].filter(Boolean).map(String).join(' ').replace(/<[^>]+>/g, ' ').trim();
  if (block.type === 'multipleChoice') return String(p.question ?? '').trim();
  return '';
}

export interface AccProps {
  hidden: boolean;         // aria-hidden
  label?: string;          // aria-label when the visible content isn't text
}

// Blocks a learner operates or reads values from. These always reach screen
// readers in Auto mode, even when they carry no plain text of their own (a
// drag-and-drop block's words live in its parts): hiding one would hide
// focusable controls, which is both a WCAG failure and a trap for keyboard users.
const INTERACTIVE = new Set<string>([
  'multipleChoice', 'matching', 'dragDrop', 'sequence', 'fillBlank', 'textEntry',
  'flashcards', 'tabs', 'slider', 'checklist', 'scenario', 'labeledGraphic',
  'video', 'audio', 'results', 'varDisplay', 'progress', 'timer', 'code', 'hotspot', 'button'
]);

// Decide screen-reader exposure. Default: expose interactive blocks and any
// block that carries text/alt; decorative shapes and text-less images are
// hidden unless the author opts in.
export function accessibilityFor(block: Block): AccProps {
  const text = blockText(block);
  const mode = block.aria ?? 'auto';
  const label = block.accLabel?.trim() || undefined;
  if (mode === 'exclude') return { hidden: true };
  if (mode === 'include') return { hidden: false, label: label ?? (text || undefined) };
  // auto
  const has = Boolean(text || label || INTERACTIVE.has(block.type));
  return has ? { hidden: false, label: label && !text ? label : undefined } : { hidden: true };
}
