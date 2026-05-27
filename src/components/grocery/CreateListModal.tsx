import { useEffect, useRef, useState, type FormEvent } from 'react';

interface CreateListModalProps {
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export default function CreateListModal({ onClose, onSubmit }: CreateListModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError('Please enter a name for the list.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create list.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-labelledby="create-list-title"
      aria-modal="true"
      className="fixed inset-0 z-[180] flex items-end justify-center bg-black/70 px-4 pb-8 sm:items-center sm:pb-0"
      role="dialog"
    >
      {/* Backdrop */}
      <button
        aria-label="Cancel"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />

      {/* Sheet */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50">
        {/* Accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300" />

        <div className="space-y-4 p-5">
          <div>
            <h2
              className="text-lg font-black text-zinc-100"
              id="create-list-title"
            >
              New grocery list
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Lists are shared with your whole household.
            </p>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-300">List name</span>
              <input
                ref={inputRef}
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                disabled={isSubmitting}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="e.g. Weekly shop, Costco run…"
                value={name}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                className="h-11 rounded-xl border border-zinc-700 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
                disabled={isSubmitting}
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-11 rounded-xl bg-blue-500 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
                disabled={isSubmitting || !name.trim()}
                type="submit"
              >
                {isSubmitting ? 'Creating…' : 'Create list'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
