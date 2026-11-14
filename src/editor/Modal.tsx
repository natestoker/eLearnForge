import { ReactNode, useEffect, useId, useRef } from 'react';
import { useFocusTrap } from '../shared/useFocusTrap';

export function Modal({ title, children, onClose, width = '600px' }: { title: string; children: ReactNode; onClose: () => void, width?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close" aria-label="Close">x</button>
        </div>
        <div className="modal-body panel-scroll">
          {children}
        </div>
      </div>
    </div>
  );
}
