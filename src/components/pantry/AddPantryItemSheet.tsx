import { useState, type FormEvent } from 'react';
import { useConfirm } from '../common/useConfirm';
import {
  ITEM_CATEGORIES,
  STORAGE_LOCATIONS,
  type StorageLocation,
} from '../../lib/constants';
import {
  normalizeDateForDb,
  parseUserDateInput,
} from '../../lib/dates';
import {
  getPantryItemName,
  type PantryItem,
  type PantryItemInput,
} from '../../services/pantryService';

interface AddPantryItemSheetProps {
  item?: PantryItem;
  onClose: () => void;
  onSubmit: (item: PantryItemInput) => Promise<void>;
}

export default function AddPantryItemSheet({
  item,
  onClose,
  onSubmit,
}: AddPantryItemSheetProps) {
  const confirm = useConfirm();
  const today = normalizeDateForDb(new Date());
  const [name, setName] = useState(item ? getPantryItemName(item) : '');
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '1');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [storageLocation, setStorageLocation] = useState<StorageLocation>(
    item?.storage_location ?? 'pantry',
  );
  const [boughtDate, setBoughtDate] = useState(item?.bought_date ?? today);
  const [hasExpiration, setHasExpiration] = useState(
    item?.has_expiration ?? true,
  );
  const [expirationDate, setExpirationDate] = useState(
    item?.expiration_date ?? '',
  );
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [trackQuantity, setTrackQuantity] = useState(item?.track_quantity ?? false);
  const [lowStockThreshold, setLowStockThreshold] = useState(
    item?.low_stock_threshold ? String(item.low_stock_threshold) : '',
  );
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function normalizeInputDate(value: string) {
    return parseUserDateInput(value) ?? value;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedBoughtDate = parseUserDateInput(boughtDate);
    const parsedExpirationDate = hasExpiration
      ? parseUserDateInput(expirationDate)
      : null;
    const parsedQuantity = Number(quantity);
    const parsedLowStockThreshold = lowStockThreshold
      ? Number(lowStockThreshold)
      : null;

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    if (!parsedBoughtDate) {
      setError('Bought date must be a real date.');
      return;
    }

    if (
      trackQuantity &&
      (parsedLowStockThreshold === null ||
        !Number.isFinite(parsedLowStockThreshold) ||
        parsedLowStockThreshold <= 0)
    ) {
      setError('Low stock threshold must be greater than zero.');
      return;
    }

    if (hasExpiration && !parsedExpirationDate) {
      setError('Expiration date is required and must be a real date.');
      return;
    }

    if (
      parsedExpirationDate &&
      parsedExpirationDate < parsedBoughtDate &&
      !(await confirm({
        title: 'Save unusual date?',
        description: 'Expiration is before the bought date. Save anyway?',
        confirmLabel: 'Save anyway',
      }))
    ) {
      return;
    }

    if (
      parsedExpirationDate &&
      parsedExpirationDate < today &&
      !(await confirm({
        title: 'Save expired item?',
        description: 'This item is already expired. Save anyway?',
        confirmLabel: 'Save anyway',
      }))
    ) {
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      await onSubmit({
        name: name.trim(),
        quantity: parsedQuantity,
        unit,
        category,
        storage_location: storageLocation,
        bought_date: parsedBoughtDate,
        has_expiration: hasExpiration,
        expiration_date: parsedExpirationDate,
        notes,
        track_quantity: trackQuantity,
        low_stock_threshold: parsedLowStockThreshold,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save pantry item.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 animate-fade-in md:items-center md:justify-center md:px-4">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <form
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black transition-all duration-300 ease-out animate-sheet-in md:max-w-2xl md:rounded-2xl"
        onSubmit={handleSubmit}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            {item ? 'Edit pantry item' : 'Add pantry item'}
          </h2>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            onClick={onClose}
            type="button"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-zinc-200">Name</span>
            <input
              autoFocus
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSaving}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Quantity</span>
            <input
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSaving}
              inputMode="decimal"
              min="1"
              onChange={(event) => setQuantity(event.target.value)}
              required
              step="1"
              type="number"
              value={quantity}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Unit</span>
            <input
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSaving}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="box, lb, cans"
              value={unit}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Category</span>
            <select
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
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
            <span className="text-sm font-medium text-zinc-200">Location</span>
            <select
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSaving}
              onChange={(event) =>
                setStorageLocation(event.target.value as StorageLocation)
              }
              value={storageLocation}
            >
              {STORAGE_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Bought date</span>
            <input
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSaving}
              inputMode="numeric"
              onBlur={() => setBoughtDate(normalizeInputDate(boughtDate))}
              onChange={(event) => setBoughtDate(event.target.value)}
              placeholder="MM/DD/YYYY"
              required
              value={boughtDate}
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-zinc-200">Expiration</span>
            <label className="flex h-12 items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-4">
              <span className="text-sm text-zinc-300">Has expiration date</span>
              <input
                checked={hasExpiration}
                className="h-5 w-5 accent-blue-500"
                disabled={isSaving}
                onChange={(event) => setHasExpiration(event.target.checked)}
                type="checkbox"
              />
            </label>
          </div>

          {hasExpiration ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-200">Expiration date</span>
              <input
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                disabled={isSaving}
                inputMode="numeric"
                onBlur={() => setExpirationDate(normalizeInputDate(expirationDate))}
                onChange={(event) => setExpirationDate(event.target.value)}
                placeholder="MM/DD/YYYY"
                required
                value={expirationDate}
              />
            </label>
          ) : null}

          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-zinc-200">Notes</span>
            <textarea
              className="min-h-24 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSaving}
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>

          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <label className="flex h-12 items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-4">
              <span className="text-sm text-zinc-300">Track quantity</span>
              <input
                checked={trackQuantity}
                className="h-5 w-5 accent-blue-500"
                disabled={isSaving}
                onChange={(event) => setTrackQuantity(event.target.checked)}
                type="checkbox"
              />
            </label>

            {trackQuantity ? (
              <input
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                aria-label="Low stock threshold"
                disabled={isSaving}
                inputMode="decimal"
                min="1"
                onChange={(event) => setLowStockThreshold(event.target.value)}
                placeholder="Low stock threshold"
                step="1"
                type="number"
                value={lowStockThreshold}
              />
            ) : (
              <div className="hidden h-12 md:block" />
            )}
          </div>
        </div>

        <button
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? 'Saving...' : item ? 'Save changes' : 'Add item'}
        </button>
      </form>
    </div>
  );
}
