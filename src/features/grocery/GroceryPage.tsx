import { useEffect, useMemo, useState } from 'react';
import BackButton from '../../components/common/BackButton';
import AddItemSheet from '../../components/grocery/AddItemSheet';
import CreateListModal from '../../components/grocery/CreateListModal';
import EditItemSheet from '../../components/grocery/EditItemSheet';
import GroceryItemRow from '../../components/grocery/GroceryItemRow';
import ListPicker from '../../components/grocery/ListPicker';
import RenameListModal from '../../components/grocery/RenameListModal';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { useConfirm } from '../../components/common/useConfirm';
import { useToast } from '../../components/common/useToast';
import { ITEM_CATEGORIES } from '../../lib/constants';
import type { GroceryItem, GroceryItemInput, GroceryList } from '../../services/groceryService';
import {
  listFavorites,
  toggleFavorite,
  type FavoriteItem,
} from '../../services/favoriteService';
import { useActiveHousehold } from '../household/useActiveHousehold';
import FavoritesSection from './FavoritesSection';
import { useGroceryItems } from './useGroceryItems';

function GroceryIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 6h15l-2 8H8L6 3H3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9 20.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM18 20.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function GroceryPage() {
  const { activeHousehold } = useActiveHousehold();
  const {
    items,
    lists,
    list,
    loading,
    error,
    refetch,
    selectList,
    createList,
    renameList,
    deleteList,
    addGroceryItem,
    updateGroceryItem,
    toggleGroceryItem,
    resetCheckedItems,
    deleteGroceryItem,
  } = useGroceryItems();
  const confirm = useConfirm();
  const showToast = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [renamingList, setRenamingList] = useState<GroceryList | null>(null);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);
  const householdId = activeHousehold?.id ?? null;
  const uncheckedItems = items.filter((item) => !item.is_checked).length;
  const checkedItems = items.length - uncheckedItems;

  useEffect(() => {
    if (!householdId) {
      return;
    }

    const activeHouseholdId = householdId;
    let cancelled = false;

    async function loadFavorites() {
      try {
        const nextFavorites = await listFavorites(activeHouseholdId);

        if (!cancelled) {
          setFavorites(nextFavorites);
        }
      } catch {
        if (!cancelled) {
          setFavorites([]);
        }
      }
    }

    void loadFavorites();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  const favoritesByName = useMemo(
    () =>
      new Map(
        favorites.map((favorite) => [favorite.name.trim().toLowerCase(), favorite]),
      ),
    [favorites],
  );

  const groupedItems = useMemo(() => {
    const categories = [...ITEM_CATEGORIES];
    return categories
      .map((category) => ({
        category,
        items: items.filter(
          (item) => (item.category || 'Other').toLowerCase() === category.toLowerCase(),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [items]);

  async function handleAddItem(item: GroceryItemInput) {
    await addGroceryItem(item);
    showToast(`Added ${item.name}.`);
  }

  async function handleEditItem(item: GroceryItemInput) {
    if (!editingItem) {
      return;
    }

    await updateGroceryItem(editingItem.id, item);
    showToast(`Updated ${item.name}.`, 'info');
  }

  async function handleDeleteItem(item: GroceryItem) {
    const shouldDelete = await confirm({
      title: 'Delete grocery item?',
      description: `Delete ${item.name} from the grocery list? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });

    if (!shouldDelete) {
      return;
    }

    await deleteGroceryItem(item.id);
    showToast(`Deleted ${item.name}.`);
  }

  async function handleResetChecked() {
    if (checkedItems === 0) {
      return;
    }

    const shouldReset = await confirm({
      title: 'Reset checked items?',
      description: `Move ${checkedItems} checked item${checkedItems === 1 ? '' : 's'} back to open on ${list?.name ?? 'this list'}?`,
      confirmLabel: 'Reset',
    });

    if (!shouldReset) {
      return;
    }

    await resetCheckedItems();
    showToast('Checked items reset.', 'info');
  }

  function handleCreateList() {
    setIsCreateListOpen(true);
  }

  async function handleCreateListSubmit(name: string) {
    await createList(name);
    showToast(`Created "${name}".`, 'info');
  }

  async function handleRenameListSubmit(id: string, name: string) {
    await renameList(id, name);
    showToast(`Renamed to "${name}".`, 'info');
  }

  async function handleDeleteList(list: GroceryList) {
    const itemCount = items.length;
    const shouldDelete = await confirm({
      title: `Delete "${list.name}"?`,
      description: itemCount > 0
        ? `This will permanently delete the list and its ${itemCount} item${itemCount === 1 ? '' : 's'}. This cannot be undone.`
        : 'This list is empty. Deleting it cannot be undone.',
      confirmLabel: 'Delete list',
      variant: 'danger',
    });

    if (!shouldDelete) return;

    await deleteList(list.id);
    showToast(`Deleted "${list.name}".`);
  }

  async function handleFavoriteToggle(item: GroceryItem) {
    if (!householdId) {
      return;
    }

    const currentFavorite = favoritesByName.get(item.name.trim().toLowerCase());
    const result = await toggleFavorite(householdId, item, currentFavorite);
    setFavorites((currentFavorites) =>
      result.isFavorite && result.favorite
        ? [...currentFavorites, result.favorite].sort((a, b) =>
            a.name.localeCompare(b.name),
          )
        : currentFavorites.filter((favorite) => favorite.id !== currentFavorite?.id),
    );
    showToast(
      result.isFavorite ? `Favorited ${item.name}.` : `Removed ${item.name}.`,
      'info',
    );
  }

  async function handleAddFavorite(favorite: FavoriteItem) {
    await handleAddItem({
      name: favorite.name,
      quantity: Number(favorite.quantity),
      unit: favorite.unit ?? undefined,
      category: favorite.category ?? undefined,
    });
  }

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20">
        <BackButton fallback="/app" />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              Shared list
            </p>
            <h1 className="mt-1 text-3xl font-black text-zinc-100">
              Grocery List
            </h1>
            <p className="text-sm text-zinc-500">
              Shared items update across the household.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Open</p>
            <p className="mt-1 text-2xl font-black text-zinc-100">{uncheckedItems}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Done</p>
            <p className="mt-1 text-2xl font-black text-blue-300">{checkedItems}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Total</p>
            <p className="mt-1 text-2xl font-black text-emerald-300">{items.length}</p>
          </div>
        </div>
      </div>

      <ListPicker
        activeListId={list?.id ?? null}
        lists={lists}
        onCreate={handleCreateList}
        onDelete={(l) => void handleDeleteList(l)}
        onRename={(l) => setRenamingList(l)}
        onSelect={(listId) => void selectList(listId)}
      />

      <FavoritesSection
        favorites={favorites}
        onAdd={(favorite) => void handleAddFavorite(favorite)}
      />

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {loading ? (
        <div className="space-y-3">
          <LoadingSkeleton className="h-20 w-full" />
          <LoadingSkeleton className="h-20 w-full" />
          <LoadingSkeleton className="h-20 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          action={
            <button
              className="h-11 rounded-xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400"
              onClick={() => setIsAddOpen(true)}
              type="button"
            >
              Add first item
            </button>
          }
          description="Add what you need and it will stay synced for everyone in the household."
          icon={<GroceryIcon />}
          title="Your list is empty"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex h-11 items-center justify-between gap-3 rounded-xl px-2 sm:min-w-56">
              <span className="text-sm font-semibold text-zinc-300">
                Group by category
              </span>
              <input
                checked={groupByCategory}
                className="h-5 w-5 accent-blue-500"
                onChange={(event) => setGroupByCategory(event.target.checked)}
                type="checkbox"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={checkedItems === 0}
                onClick={() => void handleResetChecked()}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 12a9 9 0 0 1 15-6.7M18 3v6h-6M21 12a9 9 0 0 1-15 6.7M6 21v-6h6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.9"
                  />
                </svg>
                Reset
              </button>
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition-colors hover:bg-blue-400"
                onClick={() => setIsAddOpen(true)}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2.2"
                  />
                </svg>
                Add
              </button>
            </div>
          </div>
          {groupByCategory ? (
            groupedItems.map((group) => (
              <section className="space-y-2" key={group.category}>
                <h2 className="px-1 text-sm font-bold text-zinc-400">
                  {group.category}
                </h2>
                <ul className="space-y-3">
                  {group.items.map((item) => (
                    <GroceryItemRow
                      isFavorite={favoritesByName.has(item.name.trim().toLowerCase())}
                      item={item}
                      key={item.id}
                      onDelete={handleDeleteItem}
                      onEdit={setEditingItem}
                      onFavorite={(nextItem) => void handleFavoriteToggle(nextItem)}
                      onToggle={toggleGroceryItem}
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <GroceryItemRow
                  isFavorite={favoritesByName.has(item.name.trim().toLowerCase())}
                  item={item}
                  key={item.id}
                  onDelete={handleDeleteItem}
                  onEdit={setEditingItem}
                  onFavorite={(nextItem) => void handleFavoriteToggle(nextItem)}
                  onToggle={toggleGroceryItem}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {isCreateListOpen ? (
        <CreateListModal
          onClose={() => setIsCreateListOpen(false)}
          onSubmit={handleCreateListSubmit}
        />
      ) : null}

      {renamingList ? (
        <RenameListModal
          list={renamingList}
          onClose={() => setRenamingList(null)}
          onSubmit={handleRenameListSubmit}
        />
      ) : null}

      {isAddOpen ? (
        <AddItemSheet
          onClose={() => setIsAddOpen(false)}
          onSubmit={handleAddItem}
        />
      ) : null}

      {editingItem ? (
        <EditItemSheet
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={handleEditItem}
        />
      ) : null}
    </div>
  );
}
