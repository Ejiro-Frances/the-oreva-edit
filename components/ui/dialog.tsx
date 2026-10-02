'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export function Dialog({
  open,
  onClose,
  title,
  children,
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        dialog.close();
        document.body.style.overflow = previous;
      };
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${side ? 'drawer' : ''}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={`Close ${title.toLowerCase()}`}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
