import { useState, type FormEvent } from 'react';
import { ITEM_CATEGORIES } from '../../lib/constants';
import type { GroceryItem, GroceryItemInput } from '../../services/groceryService';

interface GroceryItemSheetProps {
  mode: 'add' | 'edit';
  item?: GroceryItem;
  onClose: () => void;
  onSubmit: (item: GroceryItemInput) => Promise<void>;
}

export default function GroceryItemSheet({
  mode,
  item,
  onClose,
  onSubmit,
}: GroceryItemSheetProps) {
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '1');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedQuantity = Number(quantity);

    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      await onSubmit({
        name: trimmedName,
        quantity: parsedQuantity,
        unit,
        category,
        notes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save item.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 px-0 animate-fade-in md:items-center md:justify-center md:px-4">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <form
        className="relative w-full rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black transition-all duration-300 ease-out animate-sheet-in md:max-w-lg md:rounded-2xl"
        onSubmit={handleSubmit}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            {mode === 'add' ? 'Add grocery item' : 'Edit grocery item'}
          </h2>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            onClick={onClose}
            type="button"
          >
            <span className="sr-only">Close</span>
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

        {error ? (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Name</span>
            <input
              autoFocus
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSaving}
              onChange={(event) => setName(event.target.value)}
              placeholder="Milk"
              required
              value={name}
            />
          </label>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-200">Quantity</span>
              <input
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                disabled={isSaving}
                inputMode="decimal"
                min="0.01"
                onChange={(event) => setQuantity(event.target.value)}
                required
                step="0.01"
                type="number"
                value={quantity}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-200">Unit</span>
              <input
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                disabled={isSaving}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="gal"
                value={unit}
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Category</span>
            <select
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSaving}
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            >
              <option value="">Choose category</option>
              {ITEM_CATEGORIES.map((nextCategory) => (
                <option key={nextCategory} value={nextCategory}>
                  {nextCategory}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Notes</span>
            <textarea
              className="min-h-24 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSaving}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Brand, size, or store note"
              value={notes}
            />
          </label>
        </div>

        <button
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? 'Saving...' : mode === 'add' ? 'Add item' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
