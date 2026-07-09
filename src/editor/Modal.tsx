import { ReactNode, useEffect } from 'react';

export function Modal({ title, children, onClose, width = '600px' }: { title: string; children: ReactNode; onClose: () => void, width?: string }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close">x</button>
        </div>
        <div className="modal-body panel-scroll">
          {children}
        </div>
      </div>
    </div>
  );
}
