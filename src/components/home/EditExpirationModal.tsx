import { useState } from 'react';
import type { FormEvent } from 'react';
import { parseUserDateInput } from '../../lib/dates';
import {
  getPantryItemName,
  type PantryItem,
  type PantryItemPatch,
} from '../../services/pantryService';

interface EditExpirationModalProps {
  item: PantryItem;
  onClose: () => void;
  onSubmit: (id: string, patch: PantryItemPatch) => Promise<void>;
}

export default function EditExpirationModal({
  item,
  onClose,
  onSubmit,
}: EditExpirationModalProps) {
  const [dateInput, setDateInput] = useState(item.expiration_date ?? '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const parsedDate = parseUserDateInput(dateInput);

    if (!parsedDate) {
      setError('Use a valid date like 2026-06-12 or 6/12/26.');
      return;
    }

    setIsSaving(true);

    try {
      await onSubmit(item.id, {
        has_expiration: true,
        expiration_date: parsedDate,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the date.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center">
      <form
        className="w-full rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black sm:max-w-md"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
              Edit date
            </p>
            <h2 className="mt-1 text-xl font-black text-zinc-100">
              {getPantryItemName(item)}
            </h2>
          </div>
          <button
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            onClick={onClose}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-zinc-200">Expiration date</span>
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-blue-500"
            inputMode="numeric"
            onChange={(event) => setDateInput(event.target.value)}
            placeholder="YYYY-MM-DD or M/D/YY"
            value={dateInput}
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            className="h-11 flex-1 rounded-xl border border-zinc-800 font-semibold text-zinc-200 hover:bg-zinc-900"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-11 flex-1 rounded-xl bg-blue-500 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
