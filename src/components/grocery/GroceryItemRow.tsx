import type { GroceryItem } from '../../services/groceryService';

interface GroceryItemRowProps {
  item: GroceryItem;
  onToggle: (item: GroceryItem) => void;
  onEdit: (item: GroceryItem) => void;
  onDelete: (item: GroceryItem) => void;
  onFavorite?: (item: GroceryItem) => void;
  isFavorite?: boolean;
}

function formatQuantity(item: GroceryItem) {
  const quantity = Number(item.quantity);
  const formatted = Number.isInteger(quantity)
    ? quantity.toString()
    : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  return item.unit ? `${formatted} ${item.unit}` : formatted;
}

function formatAddedBy(item: GroceryItem) {
  return item.added_by_display_name
    ? `Added by ${item.added_by_display_name}`
    : 'Added by household member';
}

export default function GroceryItemRow({
  item,
  isFavorite = false,
  onToggle,
  onEdit,
  onDelete,
  onFavorite,
}: GroceryItemRowProps) {
  const isChecked = item.is_checked;

  return (
    <li
      className={`group overflow-hidden rounded-2xl border shadow-lg shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-black/20 ${
        isChecked
          ? 'border-blue-500/20 bg-blue-500/[0.05]'
          : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-700'
      }`}
    >
      <div
        className={`h-1 w-full ${
          isChecked ? 'bg-blue-500' : 'bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300'
        }`}
      />
      <div className="relative flex items-start gap-3 p-4">
        {isChecked ? (
          <span
            className="pointer-events-none absolute left-3 right-3 top-1/2 z-20 h-1 -rotate-1 rounded-full bg-red-400/80 shadow-[0_0_0_1px_rgba(239,68,68,0.25),0_0_12px_rgba(239,68,68,0.22)]"
            aria-hidden="true"
          />
        ) : null}
        <button
          aria-label={item.is_checked ? 'Mark as unchecked' : 'Mark as checked'}
          className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-inner transition-all ${
            isChecked
              ? 'border-blue-400 bg-blue-500 text-white shadow-blue-950/40'
              : 'border-zinc-700 bg-zinc-950 text-zinc-500 hover:border-blue-400 hover:bg-blue-500/10 hover:text-blue-300'
          }`}
          onClick={() => onToggle(item)}
          type="button"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="m5 12 4 4L19 6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.2"
            />
          </svg>
        </button>

        <div className="relative min-w-0 flex-1">
          <p
            className={`truncate text-base font-semibold ${
              isChecked
                ? 'text-zinc-500'
                : 'text-zinc-100'
            }`}
          >
            {item.name}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-300">
              {formatQuantity(item)}
            </span>
            {item.category ? (
              <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-200">
                {item.category}
              </span>
            ) : null}
            {item.notes ? (
              <span className="max-w-full truncate rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-400">
                {item.notes}
              </span>
            ) : null}
          </div>
          <p className="mt-2 truncate text-xs text-zinc-500">
            {formatAddedBy(item)}
          </p>
        </div>

        <div className="flex shrink-0 gap-1">
          {onFavorite && !isChecked ? (
            <button
              aria-label={isFavorite ? `Unfavorite ${item.name}` : `Favorite ${item.name}`}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition-colors ${
                isFavorite
                  ? 'text-amber-300 hover:bg-amber-500/10'
                  : 'text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800 hover:text-amber-300'
              }`}
              onClick={() => onFavorite(item)}
              type="button"
            >
              <svg className="h-5 w-5" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          ) : null}
          {!isChecked ? (
            <>
              <button
                aria-label={`Edit ${item.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-zinc-400 opacity-80 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 group-hover:opacity-100"
                onClick={() => onEdit(item)}
                type="button"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="m4 16.5-.75 4.25L7.5 20 18.75 8.75a2.12 2.12 0 0 0-3-3L4.5 17Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
              <button
                aria-label={`Delete ${item.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-zinc-400 opacity-80 transition-colors hover:border-red-500/25 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                onClick={() => onDelete(item)}
                type="button"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 14h8l1-14"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
