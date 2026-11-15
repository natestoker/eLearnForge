import { useEffect } from 'react';
import { useUiStore } from '../state/uiStore';
import { Lucide } from './lucide';

// One toast at a time, bottom-center. Used for "deleted · Undo" so a delete is
// never a dead end and never needs a confirm dialog.
export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const setToast = useUiStore((s) => s.setToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast, setToast]);
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.action && <button type="button" className="toast-action" onClick={() => { toast.action!.run(); setToast(null); }}>{toast.action.label}</button>}
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToast(null)}><Lucide name="x" size={14} /></button>
    </div>
  );
}
