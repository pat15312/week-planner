import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      const details = previous instanceof HTMLElement ? previous.closest('details') : null;
      if (details && !details.open) details.querySelector('summary')?.focus();
      else if (previous instanceof HTMLElement && previous !== document.body && previous.isConnected && previous.getClientRects().length) previous.focus();
      else document.querySelector<HTMLElement>('[data-plan-options]')?.focus();
    };
  }, []);
  return createPortal(
    <dialog ref={ref} aria-label={title} onCancel={onClose} className="app-dialog" onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="action-button" aria-label={`Close ${title}`}>Close</button>
      </div>
      {children}
    </dialog>, document.body,
  );
}
