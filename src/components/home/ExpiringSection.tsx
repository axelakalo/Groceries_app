import { useState } from 'react';
import ExpirationBadge from '../pantry/ExpirationBadge';
import {
  getPantryItemName,
  type PantryItem,
} from '../../services/pantryService';

interface ExpiringSectionProps {
  title: string;
  accentClassName: string;
  items: PantryItem[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onAddToGrocery: (item: PantryItem) => void;
  onEditDate?: (item: PantryItem) => void;
  onMarkDiscarded?: (item: PantryItem) => void;
  onMarkUsed?: (item: PantryItem) => void;
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

export default function ExpiringSection({
  title,
  accentClassName,
  items,
  collapsible = false,
  defaultCollapsed = false,
  onAddToGrocery,
  onEditDate,
  onMarkDiscarded,
  onMarkUsed,
}: ExpiringSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  if (items.length === 0) {
    return null;
  }

  const visibleItems = isCollapsed ? [] : items;

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-lg shadow-black/10">
      <div className={`h-1 w-full ${accentClassName}`} />
      <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100">
            <Icon path="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </span>
          <div>
            <h2 className="font-black text-zinc-100">{title}</h2>
            <p className="text-sm text-zinc-500">
              {items.length} item{items.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        {collapsible ? (
          <button
            className="flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
            onClick={() => setIsCollapsed((value) => !value)}
            type="button"
          >
            <Icon
              className={`h-4 w-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
              path="m6 9 6 6 6-6"
            />
            {isCollapsed ? 'Show' : 'Hide'}
          </button>
        ) : null}
      </div>

      {visibleItems.length > 0 ? (
        <div className="mt-4 space-y-3">
          {visibleItems.map((item) => (
            <div
              className="group rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3 transition-all hover:-translate-y-0.5 hover:border-zinc-700"
              key={item.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-100">
                    {getPantryItemName(item)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium capitalize text-zinc-300">
                      {item.storage_location}
                    </span>
                    <ExpirationBadge expirationDate={item.expiration_date} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                  {onMarkUsed ? (
                    <button
                      aria-label={`Mark ${getPantryItemName(item)} used`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-emerald-200 hover:bg-zinc-800"
                      onClick={() => onMarkUsed(item)}
                      title="Mark used"
                      type="button"
                    >
                      <Icon className="h-4 w-4" path="m5 12 4 4L19 6" />
                    </button>
                  ) : null}
                  {onMarkDiscarded ? (
                    <button
                      aria-label={`Throw away ${getPantryItemName(item)}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-red-200 hover:bg-zinc-800"
                      onClick={() => onMarkDiscarded(item)}
                      title="Throw away"
                      type="button"
                    >
                      <Icon className="h-4 w-4" path="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 14h8l1-14" />
                    </button>
                  ) : null}
                  <button
                    aria-label={`Add ${getPantryItemName(item)} to grocery list`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white hover:bg-blue-400"
                    onClick={() => onAddToGrocery(item)}
                    title="Add to grocery"
                    type="button"
                  >
                    <Icon className="h-4 w-4" path="M6 6h15l-2 8H8L6 3H3M9 20h.01M18 20h.01" />
                  </button>
                  {onEditDate ? (
                    <button
                      aria-label={`Edit expiration date for ${getPantryItemName(item)}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                      onClick={() => onEditDate(item)}
                      title="Edit date"
                      type="button"
                    >
                      <Icon className="h-4 w-4" path="m4 16.5-.75 4.25L7.5 20 18.75 8.75a2.12 2.12 0 0 0-3-3L4.5 17Z" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      </div>
    </section>
  );
}
