import type { ReactNode } from 'react';

// Shown when a ribbon tab has nothing to offer yet (no block selected, or the
// content lives in a side panel). Same height and left edge as a real group,
// so switching tabs never shifts the layout.
export function RibbonEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="ribbon-empty">
      <span className="ribbon-empty-title">{title}</span>
      {children && <span className="ribbon-empty-hint">{children}</span>}
    </div>
  );
}
