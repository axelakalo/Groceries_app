import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ActivityFeed from '../../components/home/ActivityFeed';
import EditExpirationModal from '../../components/home/EditExpirationModal';
import ExpiringSection from '../../components/home/ExpiringSection';
import LowStockSection from '../../components/home/LowStockSection';
import QuickActions from '../../components/home/QuickActions';
import EmptyState from '../../components/common/EmptyState';
import AddPantryToGroceryModal from '../../components/grocery/AddPantryToGroceryModal';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { useConfirm } from '../../components/common/useConfirm';
import { useToast } from '../../components/common/useToast';
import { supabase } from '../../lib/supabaseClient';
import { getExpirationStatus } from '../../lib/dates';
import {
  addFromPantryItem,
  DuplicateGroceryItemError,
  getUncheckedItemCount,
  type GroceryList,
} from '../../services/groceryService';
import {
  getPantryItemName,
  type PantryItem,
  type PantryItemPatch,
} from '../../services/pantryService';
import { useAuth } from '../auth/useAuth';
import { useActiveHousehold } from '../household/useActiveHousehold';
import { usePantryItems } from '../pantry/usePantryItems';

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 17) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

function sortByExpiration(items: PantryItem[]) {
  return [...items].sort((a, b) => {
    if (!a.expiration_date || !b.expiration_date) {
      return 0;
    }

    return a.expiration_date.localeCompare(b.expiration_date);
  });
}

function getDisplayNameCacheKey(userId: string) {
  return `pantrysync.displayName.${userId}`;
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

export default function HomePage() {
  const { user } = useAuth();
  const { activeHousehold } = useActiveHousehold();
  const {
    items,
    loading,
    refetch,
    markItemDiscarded,
    markItemUsed,
    updateItem,
  } = usePantryItems();
  const confirm = useConfirm();
  const showToast = useToast();
  const [displayName, setDisplayName] = useState<string | null | undefined>(
    undefined,
  );
  const [uncheckedCount, setUncheckedCount] = useState(0);
  const [editingExpirationItem, setEditingExpirationItem] =
    useState<PantryItem | null>(null);
  const [groceryPickerItem, setGroceryPickerItem] = useState<PantryItem | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    const userId = user.id;
    let cancelled = false;

    async function loadProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle();

      if (!cancelled) {
        const nextDisplayName = data?.display_name ?? null;
        setDisplayName(nextDisplayName);

        if (nextDisplayName) {
          localStorage.setItem(getDisplayNameCacheKey(userId), nextDisplayName);
        } else {
          localStorage.removeItem(getDisplayNameCacheKey(userId));
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const cachedDisplayName = useMemo(() => {
    if (!user) {
      return undefined;
    }

    return localStorage.getItem(getDisplayNameCacheKey(user.id)) ?? undefined;
  }, [user]);

  const greetingName = displayName === undefined ? cachedDisplayName : displayName;

  const loadUncheckedCount = useCallback(async () => {
    if (!activeHousehold) {
      return;
    }

    try {
      const count = await getUncheckedItemCount(activeHousehold.id);
      setUncheckedCount(count);
    } catch {
      setUncheckedCount(0);
    }
  }, [activeHousehold]);

  useEffect(() => {
    if (!activeHousehold) {
      return;
    }

    const householdId = activeHousehold.id;
    let cancelled = false;

    async function loadInitialCount() {
      try {
        const count = await getUncheckedItemCount(householdId);

        if (!cancelled) {
          setUncheckedCount(count);
        }
      } catch {
        if (!cancelled) {
          setUncheckedCount(0);
        }
      }
    }

    void loadInitialCount();

    return () => {
      cancelled = true;
    };
  }, [activeHousehold]);

  const activeExpiringItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === 'active' &&
          item.has_expiration &&
          item.expiration_date !== null,
      ),
    [items],
  );

  const expiredItems = useMemo(
    () =>
      sortByExpiration(
        activeExpiringItems.filter((item) => {
          const status = getExpirationStatus(item.expiration_date);
          return status === 'expired';
        }),
      ),
    [activeExpiringItems],
  );

  const todayItems = useMemo(
    () =>
      sortByExpiration(
        activeExpiringItems.filter(
          (item) => getExpirationStatus(item.expiration_date) === 'today',
        ),
      ),
    [activeExpiringItems],
  );

  const weekItems = useMemo(
    () =>
      sortByExpiration(
        activeExpiringItems.filter(
          (item) => getExpirationStatus(item.expiration_date) === 'soon',
        ),
      ).slice(0, 5),
    [activeExpiringItems],
  );

  const monthItems = useMemo(
    () =>
      sortByExpiration(
        activeExpiringItems.filter(
          (item) => getExpirationStatus(item.expiration_date) === 'month',
        ),
      ),
    [activeExpiringItems],
  );

  async function handleAddToGrocery(
    item: PantryItem,
    list: GroceryList,
    allowDuplicate = false,
  ) {
    setError('');

    try {
      await addFromPantryItem(item, { allowDuplicate, listId: list.id });
      await loadUncheckedCount();
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

      setError(err instanceof Error ? err.message : 'Could not add item.');
    }
  }

  async function handleMarkUsed(item: PantryItem) {
    try {
      await markItemUsed(item.id);
      showToast(`Marked ${getPantryItemName(item)} used.`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not mark item used.', 'error');
    }
  }

  async function handleMarkDiscarded(item: PantryItem) {
    const shouldDiscard = await confirm({
      title: 'Throw away item?',
      description: `Move ${getPantryItemName(item)} to discarded items?`,
      confirmLabel: 'Throw away',
      variant: 'danger',
    });

    if (!shouldDiscard) {
      return;
    }

    try {
      await markItemDiscarded(item.id);
      showToast(`Discarded ${getPantryItemName(item)}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not discard item.', 'error');
    }
  }

  async function handleEditExpiration(id: string, patch: PantryItemPatch) {
    await updateItem(id, patch);
    showToast('Expiration date updated.', 'info');
  }

  async function handleRefresh() {
    await Promise.all([refetch(), loadUncheckedCount()]);
    showToast('Dashboard refreshed.', 'info');
  }

  const hasExpiringItems =
    expiredItems.length > 0 ||
    todayItems.length > 0 ||
    weekItems.length > 0 ||
    monthItems.length > 0;
  const activeItems = items.filter((item) => item.status === 'active').length;
  const lowStockItems = items.filter(
    (item) =>
      item.status === 'active' &&
      item.track_quantity &&
      item.low_stock_threshold !== null &&
      Number(item.quantity) <= Number(item.low_stock_threshold),
  );

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              PantrySync
            </p>
            <h1 className="mt-1 text-3xl font-black text-zinc-100">
              {getGreeting()}
              {greetingName === undefined ? '' : `, ${greetingName || 'there'}`}
            </h1>
            <p className="truncate text-sm text-zinc-500">
              {activeHousehold?.name ?? 'Your household'} pantry overview
            </p>
          </div>
          <button
            aria-label="Refresh dashboard"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-300 transition-all hover:-translate-y-0.5 hover:border-zinc-700 hover:text-zinc-100"
            onClick={() => void handleRefresh()}
            type="button"
          >
            <Icon path="M3 12a9 9 0 0 1 15-6.7M18 3v6h-6M21 12a9 9 0 0 1-15 6.7M6 21v-6h6" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Pantry</p>
            <p className="mt-1 text-2xl font-black text-zinc-100">{activeItems}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Urgent</p>
            <p className="mt-1 text-2xl font-black text-red-300">
              {expiredItems.length + todayItems.length}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Groceries</p>
            <p className="mt-1 text-2xl font-black text-blue-300">{uncheckedCount}</p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <QuickActions />

      {loading ? (
        <div className="space-y-3">
          <LoadingSkeleton className="h-32 w-full" />
          <LoadingSkeleton className="h-32 w-full" />
        </div>
      ) : hasExpiringItems ? (
        <div className="space-y-3">
          <ExpiringSection
            accentClassName="bg-red-900"
            items={expiredItems}
            onAddToGrocery={setGroceryPickerItem}
            onEditDate={setEditingExpirationItem}
            onMarkDiscarded={(item) => void handleMarkDiscarded(item)}
            onMarkUsed={(item) => void handleMarkUsed(item)}
            title="Already expired"
          />
          <ExpiringSection
            accentClassName="bg-red-500"
            items={todayItems}
            onAddToGrocery={setGroceryPickerItem}
            onEditDate={setEditingExpirationItem}
            onMarkDiscarded={(item) => void handleMarkDiscarded(item)}
            onMarkUsed={(item) => void handleMarkUsed(item)}
            title="Expiring today"
          />
          <ExpiringSection
            accentClassName="bg-orange-500"
            items={weekItems}
            onAddToGrocery={setGroceryPickerItem}
            onEditDate={setEditingExpirationItem}
            onMarkDiscarded={(item) => void handleMarkDiscarded(item)}
            onMarkUsed={(item) => void handleMarkUsed(item)}
            title="Expiring this week"
          />
          <ExpiringSection
            accentClassName="bg-yellow-400"
            collapsible
            defaultCollapsed
            items={monthItems}
            onAddToGrocery={setGroceryPickerItem}
            onEditDate={setEditingExpirationItem}
            onMarkDiscarded={(item) => void handleMarkDiscarded(item)}
            onMarkUsed={(item) => void handleMarkUsed(item)}
            title="Expiring this month"
          />
        </div>
      ) : (
        <EmptyState
          description="Nothing needs attention in the next 30 days."
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="m5 12 4 4L19 6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          }
          title="Nothing expiring soon. Nice work."
        />
      )}

      {!loading ? (
        <LowStockSection
          items={lowStockItems}
          onAddToGrocery={setGroceryPickerItem}
        />
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-lg shadow-black/10">
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300" />
        <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <Icon path="M6 6h15l-2 8H8L6 3H3M9 20h.01M18 20h.01" />
          </div>
          <div>
            <h2 className="font-black text-zinc-100">Grocery list</h2>
            <p className="text-sm text-zinc-500">
              {uncheckedCount} unchecked item{uncheckedCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
          <Link
            className="flex h-11 items-center gap-2 rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
            to="/app/grocery"
          >
            Open
            <Icon className="h-4 w-4" path="M9 5l7 7-7 7" />
          </Link>
        </div>
      </section>

      {activeHousehold ? <ActivityFeed householdId={activeHousehold.id} /> : null}

      {editingExpirationItem ? (
        <EditExpirationModal
          item={editingExpirationItem}
          onClose={() => setEditingExpirationItem(null)}
          onSubmit={handleEditExpiration}
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
