import {
  getPantryItemName,
  type PantryItem,
} from '../../services/pantryService';
import { getExpirationStatus } from '../../lib/dates';
import ExpirationBadge from './ExpirationBadge';

interface PantryItemCardProps {
  item: PantryItem;
  onEdit: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
  onMarkUsed: (item: PantryItem) => void;
  onMarkDiscarded: (item: PantryItem) => void;
  onRestore: (item: PantryItem) => void;
  onAddAgain?: (item: PantryItem) => void;
  onAddToGrocery?: (item: PantryItem) => void;
}

function formatQuantity(item: PantryItem) {
  const quantity = Number(item.quantity);
  const formatted = Number.isInteger(quantity)
    ? quantity.toString()
    : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  return item.unit ? `${formatted} ${item.unit}` : formatted;
}

function getLocationIcon(location: PantryItem['storage_location']) {
  if (location === 'fridge') {
    return 'M7 3h10a2 2 0 0 1 2 2v15H5V5a2 2 0 0 1 2-2ZM5 10h14M9 6h1M9 14h1';
  }

  if (location === 'freezer') {
    return 'M12 3v18M5.6 6.5l12.8 11M18.4 6.5l-12.8 11M5 12h14';
  }

  return 'M5 4h14v17H5V4ZM8 4v17M16 4v17M5 11h14';
}

function Icon({ path, className = 'h-4 w-4' }: { path: string; className?: string }) {
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

export default function PantryItemCard({
  item,
  onEdit,
  onDelete,
  onMarkUsed,
  onMarkDiscarded,
  onRestore,
  onAddAgain,
  onAddToGrocery,
}: PantryItemCardProps) {
  const name = getPantryItemName(item);
  const isInactive = item.status !== 'active';
  const isExpired =
    item.status === 'active' && getExpirationStatus(item.expiration_date) === 'expired';
  const isLowStock =
    item.status === 'active' &&
    item.track_quantity &&
    item.low_stock_threshold !== null &&
    Number(item.quantity) <= Number(item.low_stock_threshold);

  return (
    <article
      className={`group overflow-hidden rounded-2xl border shadow-lg shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-black/20 ${
        isInactive
          ? 'border-zinc-800 bg-zinc-900/55'
          : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-700'
      }`}
    >
      <div className={`h-1 w-full ${isInactive ? 'bg-zinc-700' : isExpired ? 'bg-red-800' : 'bg-gradient-to-r from-emerald-400 via-blue-500 to-amber-300'}`} />
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-blue-300 shadow-inner">
            <Icon path={getLocationIcon(item.storage_location)} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className={`truncate text-base font-semibold ${isInactive ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
              {name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
              <span className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 capitalize text-zinc-300">
                <Icon path={getLocationIcon(item.storage_location)} />
                {item.storage_location}
              </span>
              <ExpirationBadge expirationDate={item.expiration_date} />
              <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-zinc-300">
                Qty {formatQuantity(item)}
              </span>
              {item.status !== 'active' ? (
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 capitalize text-zinc-400">
                  {item.status}
                </span>
              ) : null}
              {isExpired ? (
                <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-red-200">
                  Expired
                </span>
              ) : null}
              {isLowStock ? (
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-200">
                  Low Stock
                </span>
              ) : null}
              {item.category ? (
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-200">
                  {item.category}
                </span>
              ) : null}
            </div>
            {item.notes ? (
              <p className="mt-3 line-clamp-2 text-sm text-zinc-500">{item.notes}</p>
            ) : null}
          </div>
        </div>
        {item.products?.image_url ? (
          <img
            alt=""
            className="h-16 w-16 shrink-0 rounded-2xl border border-zinc-800 object-cover"
            src={item.products.image_url}
          />
        ) : null}
      </div>

      <div className="grid gap-2 border-t border-zinc-800/80 p-3 sm:flex sm:flex-wrap sm:items-center">
        {onAddAgain && (isInactive || isExpired) ? (
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
            onClick={() => onAddAgain(item)}
            type="button"
          >
            <Icon path="M12 5v14M5 12h14" />
            Add again
          </button>
        ) : null}
        {item.status === 'active' ? (
          <>
            {onAddToGrocery ? (
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-400"
                onClick={() => onAddToGrocery(item)}
                type="button"
              >
                <Icon path="M6 6h15l-2 8H8L6 3H3M9 20h.01M18 20h.01" />
                Add to grocery
              </button>
            ) : null}
            <button
              aria-label={`Mark ${name} used`}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-emerald-200 transition-colors hover:bg-zinc-700"
              onClick={() => onMarkUsed(item)}
              title="Mark used"
              type="button"
            >
              <Icon path="m5 12 4 4L19 6" />
              Mark used
            </button>
            <button
              aria-label={`Throw away ${name}`}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/10"
              onClick={() => onMarkDiscarded(item)}
              title="Throw away"
              type="button"
            >
              <Icon path="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 14h8l1-14" />
              Throw away
            </button>
          </>
        ) : (
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-400"
            onClick={() => onRestore(item)}
            type="button"
          >
            <Icon path="M3 12a9 9 0 1 0 3-6.7M3 5v6h6" />
            Restore
          </button>
        )}
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-800 px-4 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 sm:ml-auto"
          aria-label={`Edit ${name}`}
          onClick={() => onEdit(item)}
          type="button"
        >
          <Icon path="m4 16.5-.75 4.25L7.5 20 18.75 8.75a2.12 2.12 0 0 0-3-3L4.5 17Z" className="h-5 w-5" />
          Edit
        </button>
        {isInactive ? (
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/25 px-4 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/10"
            aria-label={`Delete ${name} permanently`}
            onClick={() => onDelete(item)}
            type="button"
          >
            <Icon path="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 14h8l1-14" className="h-5 w-5" />
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
