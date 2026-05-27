import type { PantryFilter } from '../../features/pantry/PantryPage';
import { ITEM_CATEGORIES } from '../../lib/constants';

interface PantryFiltersProps {
  activeFilter: PantryFilter;
  counts: Record<PantryFilter, number>;
  onChange: (filter: PantryFilter) => void;
}

const statusFilters: { id: PantryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'expiring', label: 'Soon' },
  { id: 'expired', label: 'Expired' },
  { id: 'used', label: 'Used' },
  { id: 'discarded', label: 'Discarded' },
];

const locationFilters: { id: PantryFilter; label: string }[] = [
  { id: 'pantry', label: 'Pantry' },
  { id: 'fridge', label: 'Fridge' },
  { id: 'freezer', label: 'Freezer' },
];

function getCategoryFilter(category: string): PantryFilter {
  return `category:${category}`;
}

function getCategoryValue(activeFilter: PantryFilter) {
  return activeFilter.startsWith('category:')
    ? activeFilter.replace('category:', '')
    : '';
}

export default function PantryFilters({
  activeFilter,
  counts,
  onChange,
}: PantryFiltersProps) {
  const activeCategory = getCategoryValue(activeFilter);
  const activeLocation = locationFilters.some((filter) => filter.id === activeFilter)
    ? activeFilter
    : '';
  const hasSecondaryFilter = Boolean(activeCategory || activeLocation);

  return (
    <section className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="grid grid-cols-5 gap-1 rounded-2xl bg-zinc-900 p-1">
        {statusFilters.map((filter) => (
          <button
            className={`flex h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-sm font-semibold transition-all ${
              activeFilter === filter.id
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-950/30'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
            key={filter.id}
            onClick={() => onChange(filter.id)}
            type="button"
          >
            <span className="truncate">{filter.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[0.65rem] ${
                activeFilter === filter.id ? 'bg-white/15' : 'bg-zinc-950 text-zinc-500'
              }`}
            >
              {counts[filter.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="block">
          <span className="sr-only">Filter by location</span>
          <select
            className="h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-semibold text-zinc-200 outline-none focus:border-blue-500"
            onChange={(event) =>
              onChange(event.target.value ? (event.target.value as PantryFilter) : 'all')
            }
            value={activeLocation}
          >
            <option value="">Any location</option>
            {locationFilters.map((filter) => (
              <option key={filter.id} value={filter.id}>
                {filter.label} ({counts[filter.id]})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Filter by category</span>
          <select
            className="h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-semibold text-zinc-200 outline-none focus:border-blue-500"
            onChange={(event) =>
              onChange(
                event.target.value
                  ? getCategoryFilter(event.target.value)
                  : 'all',
              )
            }
            value={activeCategory}
          >
            <option value="">Any category</option>
            {ITEM_CATEGORIES.map((category) => {
              const filterId = getCategoryFilter(category);
              return (
                <option key={category} value={category}>
                  {category} ({counts[filterId]})
                </option>
              );
            })}
          </select>
        </label>

        <button
          className="h-11 rounded-2xl border border-zinc-800 px-4 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!hasSecondaryFilter && activeFilter === 'all'}
          onClick={() => onChange('all')}
          type="button"
        >
          Clear
        </button>
      </div>
    </section>
  );
}
