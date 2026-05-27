import { useState, type FormEvent } from 'react';
import { useConfirm } from '../common/useConfirm';
import { STORAGE_LOCATIONS, type StorageLocation } from '../../lib/constants';
import { normalizeDateForDb, parseUserDateInput } from '../../lib/dates';
import type { PantryItemInput } from '../../services/pantryService';
import type { ConfirmedProduct } from './ProductConfirmCard';

interface PantryEntryFormProps {
  product: ConfirmedProduct;
  onSubmit: (item: PantryItemInput) => Promise<void>;
}

function Icon({ path }: { path: string }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export default function PantryEntryForm({
  product,
  onSubmit,
}: PantryEntryFormProps) {
  const confirm = useConfirm();
  const today = normalizeDateForDb(new Date());
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState(product.default_unit ?? '');
  const [storageLocation, setStorageLocation] = useState<StorageLocation>(
    product.default_storage_location ?? 'pantry',
  );
  const [boughtDate, setBoughtDate] = useState(today);
  const [hasExpiration, setHasExpiration] = useState(true);
  const [expirationDate, setExpirationDate] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function normalizeInputDate(value: string) {
    return parseUserDateInput(value) ?? value;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    const parsedBoughtDate = parseUserDateInput(boughtDate);
    const parsedExpirationDate = hasExpiration
      ? parseUserDateInput(expirationDate)
      : null;

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    if (!parsedBoughtDate) {
      setError('Bought date must be a real date.');
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
        name: product.name,
        product_id: product.product?.id ?? null,
        quantity: parsedQuantity,
        unit,
        category: product.category,
        storage_location: storageLocation,
        bought_date: parsedBoughtDate,
        has_expiration: hasExpiration,
        expiration_date: parsedExpirationDate,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add pantry item.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-lg shadow-black/10"
      onSubmit={handleSubmit}
    >
      <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-blue-500 to-amber-300" />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            <Icon path="M5 4h14v17H5V4ZM8 4v17M16 4v17M5 11h14" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-100">Pantry details</h2>
            <p className="text-sm text-zinc-500">
              Expiration is always entered manually.
            </p>
          </div>
        </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">Quantity</span>
          <input
            className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
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
            className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            disabled={isSaving}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="box, lb, cans"
            value={unit}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">Location</span>
          <select
            className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            disabled={isSaving}
            onChange={(event) => setStorageLocation(event.target.value as StorageLocation)}
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
            className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            disabled={isSaving}
            inputMode="numeric"
            onBlur={() => setBoughtDate(normalizeInputDate(boughtDate))}
            onChange={(event) => setBoughtDate(event.target.value)}
            placeholder="MM/DD/YYYY"
            required
            value={boughtDate}
          />
        </label>

        <label className="flex h-12 items-center justify-between rounded-2xl border border-zinc-700 bg-zinc-950 px-4 md:col-span-2">
          <span className="text-sm text-zinc-300">Has expiration date</span>
          <input
            checked={hasExpiration}
            className="h-5 w-5 accent-blue-500"
            disabled={isSaving}
            onChange={(event) => setHasExpiration(event.target.checked)}
            type="checkbox"
          />
        </label>

        {hasExpiration ? (
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-zinc-200">Expiration date</span>
            <input
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
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
      </div>

      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
        disabled={isSaving}
        type="submit"
      >
        <Icon path="M12 5v14M5 12h14" />
        {isSaving ? 'Adding...' : 'Add to pantry'}
      </button>
      </div>
    </form>
  );
}
