import { useState, type ReactNode } from 'react';
import { Lucide } from './lucide';

// A collapsible inspector section. Closed, it shows a one-line summary of
// what is inside. Whether it is open is remembered per `id` in this browser.
export function Section({ id, title, summary, defaultOpen = false, children }: {
  id: string; title: string; summary?: string; defaultOpen?: boolean; children: ReactNode;
}) {
  const key = `elearnforge.section.${id}`;
  const [open, setOpen] = useState(() => {
    try { const v = localStorage.getItem(key); return v === null ? defaultOpen : v === '1'; } catch { return defaultOpen; }
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(key, next ? '1' : '0'); } catch { /* private mode */ }
  };
  return (
    <section className={`insp-fold${open ? ' open' : ''}`}>
      <button type="button" className="insp-fold-head" aria-expanded={open} onClick={toggle}>
        <Lucide name={open ? 'chevron-up' : 'chevron-down'} size={14} />
        <span className="insp-fold-title">{title}</span>
        {!open && summary && <span className="insp-fold-summary">{summary}</span>}
      </button>
      {open && <div className="insp-fold-body">{children}</div>}
    </section>
  );
}
