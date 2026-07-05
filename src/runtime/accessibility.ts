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
  if (block.type === 'statement') return String(p.text ?? '').trim();
  if (block.type === 'multipleChoice') return String(p.question ?? '').trim();
  return '';
}

export interface AccProps {
  hidden: boolean;         // aria-hidden
  label?: string;          // aria-label when the visible content isn't text
}

// Decide screen-reader exposure. Default: expose only blocks that carry
// text/alt; decorative shapes/media are hidden unless the author opts in.
export function accessibilityFor(block: Block): AccProps {
  const text = blockText(block);
  const mode = block.aria ?? 'auto';
  const label = block.accLabel?.trim() || undefined;
  if (mode === 'exclude') return { hidden: true };
  if (mode === 'include') return { hidden: false, label: label ?? (text || undefined) };
  // auto
  const has = Boolean(text || label);
  return has ? { hidden: false, label: label && !text ? label : undefined } : { hidden: true };
}
