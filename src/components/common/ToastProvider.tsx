import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastVariant } from './toastContext';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  error: 'border-red-500/30 bg-red-500/10 text-red-200',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 ? (
        <div
          aria-atomic="false"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2 md:bottom-6"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`animate-toast-in max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/30 ${VARIANT_CLASSES[toast.variant]}`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
