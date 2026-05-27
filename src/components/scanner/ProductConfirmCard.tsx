import { useEffect, useState, type FormEvent } from 'react';
import { useConfirm } from '../common/useConfirm';
import { ITEM_CATEGORIES, type StorageLocation } from '../../lib/constants';
import {
  createManualProduct,
  type Product,
  type ProductLookupResult,
} from '../../services/productService';
import {
  getOverride,
  saveOverride,
} from '../../services/productOverrideService';
import { useActiveHousehold } from '../../features/household/useActiveHousehold';

export interface ConfirmedProduct {
  product: Product | null;
  name: string;
  brand: string;
  category: string;
  image_url: string | null;
  default_storage_location?: StorageLocation | null;
  default_unit?: string | null;
}

interface ProductConfirmCardProps {
  barcode: string;
  lookupResult: ProductLookupResult;
  onConfirm: (product: ConfirmedProduct) => void;
}

function Icon({ path, className = 'h-5 w-5' }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden="true">
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

export default function ProductConfirmCard({
  barcode,
  lookupResult,
  onConfirm,
}: ProductConfirmCardProps) {
  const { activeHousehold } = useActiveHousehold();
  const confirm = useConfirm();
  const initialProduct = lookupResult.product;
  const [name, setName] = useState(initialProduct?.name ?? '');
  const [brand, setBrand] = useState(initialProduct?.brand ?? '');
  const [category, setCategory] = useState(initialProduct?.category ?? '');
  const [defaultStorageLocation, setDefaultStorageLocation] =
    useState<StorageLocation | null>(null);
  const [defaultUnit, setDefaultUnit] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const needsManualProduct =
    lookupResult.source === 'not_found' || lookupResult.source === 'lookup_failed';

  useEffect(() => {
    if (!activeHousehold || !initialProduct) {
      return;
    }

    const householdId = activeHousehold.id;
    const product = initialProduct;
    let cancelled = false;

    async function loadOverride() {
      try {
        const override = await getOverride(householdId, product.id);

        if (!cancelled && override) {
          setName(override.custom_name ?? product.name);
          setCategory(override.default_category ?? product.category ?? '');
          setDefaultStorageLocation(override.default_storage_location);
          setDefaultUnit(override.default_unit);
        }
      } catch {
        // Scan should still work if preferences cannot be loaded.
      }
    }

    void loadOverride();

    return () => {
      cancelled = true;
    };
  }, [activeHousehold, initialProduct]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      const product = needsManualProduct
        ? await createManualProduct({
            barcode,
            name,
            brand,
            category,
          })
        : initialProduct;

      if (
        product &&
        activeHousehold &&
        (name.trim() !== product.name || category.trim() !== (product.category ?? '')) &&
        (await confirm({
          title: 'Remember corrections?',
          description: 'Use these product details the next time this barcode is scanned?',
          confirmLabel: 'Remember',
        }))
      ) {
        await saveOverride(activeHousehold.id, product.id, {
          custom_name: name,
          default_category: category,
          default_storage_location: defaultStorageLocation,
          default_unit: defaultUnit,
        });
      }

      onConfirm({
        product: product ?? null,
        name: name.trim(),
        brand: brand.trim(),
        category: category.trim(),
        image_url: product?.image_url ?? initialProduct?.image_url ?? null,
        default_storage_location: defaultStorageLocation,
        default_unit: defaultUnit,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm product.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-lg shadow-black/10"
      onSubmit={handleSubmit}
    >
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300" />
      <div className="space-y-4 p-4">
      <div className="flex items-start gap-4">
        {initialProduct?.image_url ? (
          <img
            alt=""
            className="h-20 w-20 rounded-2xl border border-zinc-800 object-cover"
            src={initialProduct.image_url}
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-500">
            <Icon
              className="h-8 w-8"
              path="M5 4h14v16H5V4ZM8 8h8M8 12h8M8 16h5"
            />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-black text-zinc-100">Confirm product</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {needsManualProduct
              ? 'No product was found. Save the details manually.'
              : `Found via ${lookupResult.source === 'local' ? 'local cache' : 'Open Food Facts'}.`}
          </p>
          <p className="mt-2 inline-flex rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-zinc-500">
            {barcode}
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-zinc-200">Name</span>
          <input
            className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            disabled={isSaving}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">Brand</span>
          <input
            className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            disabled={isSaving}
            onChange={(event) => setBrand(event.target.value)}
            value={brand}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">Category</span>
          <select
            className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
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
      </div>

      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
        disabled={isSaving}
        type="submit"
      >
        <Icon path="m5 12 4 4L19 6" />
        {isSaving ? 'Saving...' : 'Use this product'}
      </button>
      </div>
    </form>
  );
}
