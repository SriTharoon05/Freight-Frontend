'use client';

import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${width} rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-[#f0f0f4] px-5 py-4">
          <h3 className="font-display text-[15px] font-semibold tracking-[-0.02em]">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#a0a0ab] hover:bg-[#f7f7fa]">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-[#f0f0f4] px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
