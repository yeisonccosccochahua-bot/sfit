import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150',
          sizes[size],
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function ModalBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...props} />;
}

export function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4', className)}
      {...props}
    />
  );
}
