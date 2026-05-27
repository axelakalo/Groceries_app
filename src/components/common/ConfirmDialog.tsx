import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ConfirmContext,
  type ConfirmContextValue,
  type ConfirmOptions,
  type ConfirmVariant,
} from './confirmContext';

interface ConfirmRequest extends Required<ConfirmOptions> {
  id: number;
}

const confirmClasses: Record<ConfirmVariant, string> = {
  default: 'bg-blue-500 text-white hover:bg-blue-400',
  danger: 'bg-red-500 text-white hover:bg-red-400',
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const counterRef = useRef(0);

  const confirm = useCallback<ConfirmContextValue>((options) => {
    const id = ++counterRef.current;

    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setRequest({
        id,
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? 'Continue',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        variant: options.variant ?? 'default',
      });
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  useEffect(() => {
    if (!request) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, request]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request ? (
        <div
          aria-labelledby={`confirm-title-${request.id}`}
          aria-modal="true"
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 px-4 animate-fade-in"
          role="dialog"
        >
          <button
            aria-label="Cancel"
            className="absolute inset-0 cursor-default"
            onClick={() => close(false)}
            type="button"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black transition-all duration-300 ease-out animate-dialog-in">
            <h2
              className="text-lg font-semibold text-zinc-100"
              id={`confirm-title-${request.id}`}
            >
              {request.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {request.description}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                autoFocus
                className="h-11 rounded-xl border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
                onClick={() => close(false)}
                type="button"
              >
                {request.cancelLabel}
              </button>
              <button
                className={`h-11 rounded-xl px-4 text-sm font-semibold ${confirmClasses[request.variant]}`}
                onClick={() => close(true)}
                type="button"
              >
                {request.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
