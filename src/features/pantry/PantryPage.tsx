import { useMemo, useState } from 'react';
import BackButton from '../../components/common/BackButton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import AddPantryToGroceryModal from '../../components/grocery/AddPantryToGroceryModal';
import { useConfirm } from '../../components/common/useConfirm';
import { useToast } from '../../components/common/useToast';
import AddPantryItemSheet from '../../components/pantry/AddPantryItemSheet';
import PantryFilters from '../../components/pantry/PantryFilters';
import PantryItemCard from '../../components/pantry/PantryItemCard';
import { ITEM_CATEGORIES } from '../../lib/constants';
import { getDaysUntil } from '../../lib/dates';
import {
  addFromPantryItem,
  DuplicateGroceryItemError,
  type GroceryList,
} from '../../services/groceryService';
import {
  getPantryItemName,
  type PantryItem,
  type PantryItemInput,
} from '../../services/pantryService';
import { usePantryItems } from './usePantryItems';

export type PantryFilter =
  | 'all'
  | 'expiring'
  | 'expired'
  | 'pantry'
  | 'fridge'
  | 'freezer'
  | 'used'
  | 'discarded'
  | `category:${string}`;

function PantryIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 4h14v17H5V4ZM8 4v17M16 4v17M5 11h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 12a9 9 0 0 1 15-6.7M18 3v6h-6M21 12a9 9 0 0 1-15 6.7M6 21v-6h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function matchesFilter(item: PantryItem, filter: PantryFilter) {
  if (filter.startsWith('category:')) {
    const category = filter.replace('category:', '');
    return (
      item.status === 'active' &&
      (item.category || 'Other').toLowerCase() === category.toLowerCase()
    );
  }

  if (filter === 'used' || filter === 'discarded') {
    return item.status === filter;
  }

  if (filter === 'pantry' || filter === 'fridge' || filter === 'freezer') {
    return item.status === 'active' && item.storage_location === filter;
  }

  if (filter === 'expired') {
    return (
      item.status === 'active' &&
      item.expiration_date !== null &&
      getDaysUntil(item.expiration_date) < 0
    );
  }

  if (filter === 'expiring') {
    if (item.status !== 'active' || !item.expiration_date) {
      return false;
    }

    const days = getDaysUntil(item.expiration_date);
    return days >= 0 && days <= 7;
  }

  return item.status === 'active';
}

function getActionError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function PantryPage() {
  const {
    items,
    loading,
    error,
    refetch,
    addItem,
    addItemAgain,
    updateItem,
    deleteItem,
    markItemUsed,
    markItemDiscarded,
    restoreItem,
  } = usePantryItems();
  const confirm = useConfirm();
  const showToast = useToast();
  const [filter, setFilter] = useState<PantryFilter>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [groceryPickerItem, setGroceryPickerItem] = useState<PantryItem | null>(null);

  const counts = useMemo(
    () => {
      const baseCounts = {
        all: items.filter((item) => matchesFilter(item, 'all')).length,
        expiring: items.filter((item) => matchesFilter(item, 'expiring')).length,
        expired: items.filter((item) => matchesFilter(item, 'expired')).length,
        pantry: items.filter((item) => matchesFilter(item, 'pantry')).length,
        fridge: items.filter((item) => matchesFilter(item, 'fridge')).length,
        freezer: items.filter((item) => matchesFilter(item, 'freezer')).length,
        used: items.filter((item) => matchesFilter(item, 'used')).length,
        discarded: items.filter((item) => matchesFilter(item, 'discarded')).length,
      } satisfies Record<Exclude<PantryFilter, `category:${string}`>, number>;

      return ITEM_CATEGORIES.reduce<Record<PantryFilter, number>>(
        (nextCounts, category) => ({
          ...nextCounts,
          [`category:${category}`]: items.filter((item) =>
            matchesFilter(item, `category:${category}`),
          ).length,
        }),
        baseCounts,
      );
    },
    [items],
  );

  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [filter, items],
  );

  async function handleAddItem(item: PantryItemInput) {
    await addItem(item);
  }

  async function handleEditItem(item: PantryItemInput) {
    if (!editingItem) {
      return;
    }

    await updateItem(editingItem.id, item);
  }

  async function handleDelete(item: PantryItem) {
    const shouldDelete = await confirm({
      title: 'Delete pantry item?',
      description: `Delete ${getPantryItemName(item)} from the pantry? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });

    if (!shouldDelete) {
      return;
    }

    try {
      await deleteItem(item.id);
      showToast(`Deleted ${getPantryItemName(item)}.`);
    } catch (err) {
      showToast(getActionError(err, 'Could not delete pantry item.'), 'error');
    }
  }

  async function handleAddToGrocery(
    item: PantryItem,
    list: GroceryList,
    allowDuplicate = false,
  ) {
    try {
      await addFromPantryItem(item, { allowDuplicate, listId: list.id });
      showToast(`Added ${getPantryItemName(item)} to ${list.name}.`);
    } catch (err) {
      if (err instanceof DuplicateGroceryItemError) {
        const shouldAdd = await confirm({
          title: 'Add duplicate item?',
          description: `${err.message} This duplicate would be added to ${list.name}.`,
          confirmLabel: 'Add anyway',
        });

        if (shouldAdd) {
          await handleAddToGrocery(item, list, true);
        }

        return;
      }

      showToast(err instanceof Error ? err.message : 'Could not add item.', 'error');
    }
  }

  async function handleRefresh() {
    try {
      await refetch();
      showToast('Pantry refreshed.', 'info');
    } catch (err) {
      showToast(getActionError(err, 'Could not refresh pantry.'), 'error');
    }
  }

  async function handleMarkDiscarded(item: PantryItem) {
    const shouldDiscard = await confirm({
      title: 'Mark item discarded?',
      description: `Move ${getPantryItemName(item)} to discarded items?`,
      confirmLabel: 'Discard',
      variant: 'danger',
    });

    if (!shouldDiscard) {
      return;
    }

    try {
      await markItemDiscarded(item.id);
      showToast(`Discarded ${getPantryItemName(item)}.`);
    } catch (err) {
      showToast(getActionError(err, 'Could not discard pantry item.'), 'error');
    }
  }

  async function handleMarkUsed(item: PantryItem) {
    try {
      await markItemUsed(item.id);
      showToast(`Marked ${getPantryItemName(item)} used.`, 'info');
    } catch (err) {
      showToast(getActionError(err, 'Could not mark pantry item used.'), 'error');
    }
  }

  async function handleRestoreItem(item: PantryItem) {
    try {
      await restoreItem(item.id);
      showToast(`Restored ${getPantryItemName(item)}.`, 'info');
    } catch (err) {
      showToast(getActionError(err, 'Could not restore pantry item.'), 'error');
    }
  }

  async function handleAddAgain(item: PantryItem) {
    try {
      await addItemAgain(item);
      showToast(`Added ${getPantryItemName(item)} again.`, 'info');
    } catch (err) {
      showToast(getActionError(err, 'Could not add item again.'), 'error');
    }
  }

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20">
        <BackButton fallback="/app" />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              Household inventory
            </p>
            <h1 className="mt-1 text-3xl font-black text-zinc-100">Pantry</h1>
            <p className="text-sm text-zinc-500">
              Track what you have and what expires next.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              aria-label="Refresh pantry"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-300 transition-all hover:-translate-y-0.5 hover:border-zinc-700 hover:text-zinc-100"
              onClick={() => void handleRefresh()}
              type="button"
            >
              <RefreshIcon />
            </button>
            <button
              className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 font-semibold text-white shadow-lg shadow-blue-950/30 transition-all hover:-translate-y-0.5 hover:bg-blue-400"
              onClick={() => setIsAddOpen(true)}
              type="button"
            >
              <PlusIcon />
              Add
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Active</p>
            <p className="mt-1 text-2xl font-black text-zinc-100">{counts.all}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Expiring</p>
            <p className="mt-1 text-2xl font-black text-amber-300">{counts.expiring}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Expired</p>
            <p className="mt-1 text-2xl font-black text-red-300">{counts.expired}</p>
          </div>
        </div>
      </div>

      <PantryFilters activeFilter={filter} counts={counts} onChange={setFilter} />

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {loading ? (
        <div className="space-y-3">
          <LoadingSkeleton className="h-32 w-full" />
          <LoadingSkeleton className="h-32 w-full" />
          <LoadingSkeleton className="h-32 w-full" />
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          description="Add items manually now, then barcode scanning can fill details later."
          icon={<PantryIcon />}
          title={filter === 'all' ? 'Your pantry is empty' : 'No items here'}
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <PantryItemCard
              item={item}
              key={item.id}
              onDelete={handleDelete}
              onEdit={setEditingItem}
              onAddAgain={(nextItem) => void handleAddAgain(nextItem)}
              onAddToGrocery={setGroceryPickerItem}
              onMarkDiscarded={(nextItem) => void handleMarkDiscarded(nextItem)}
              onMarkUsed={(nextItem) => void handleMarkUsed(nextItem)}
              onRestore={(nextItem) => void handleRestoreItem(nextItem)}
            />
          ))}
        </div>
      )}

      {isAddOpen ? (
        <AddPantryItemSheet
          onClose={() => setIsAddOpen(false)}
          onSubmit={handleAddItem}
        />
      ) : null}

      {editingItem ? (
        <AddPantryItemSheet
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={handleEditItem}
        />
      ) : null}

      {groceryPickerItem ? (
        <AddPantryToGroceryModal
          item={groceryPickerItem}
          onClose={() => setGroceryPickerItem(null)}
          onSelectList={(list) => handleAddToGrocery(groceryPickerItem, list)}
        />
      ) : null}
    </div>
  );
}
