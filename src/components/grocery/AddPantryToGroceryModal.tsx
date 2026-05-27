import { useEffect, useState } from 'react';
import {
  listGroceryLists,
  type GroceryList,
} from '../../services/groceryService';
import {
  getPantryItemName,
  type PantryItem,
} from '../../services/pantryService';

interface AddPantryToGroceryModalProps {
  item: PantryItem;
  onClose: () => void;
  onSelectList: (list: GroceryList) => Promise<void>;
}

export default function AddPantryToGroceryModal({
  item,
  onClose,
  onSelectList,
}: AddPantryToGroceryModalProps) {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingListId, setSavingListId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const householdId = item.household_id;
    let cancelled = false;

    async function loadLists() {
      try {
        const groceryLists = await listGroceryLists(householdId);

        if (!cancelled) {
          setLists(groceryLists);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load grocery lists.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLists();

    return () => {
      cancelled = true;
    };
  }, [item.household_id]);

  async function handleSelectList(list: GroceryList) {
    setSavingListId(list.id);
    setError('');

    try {
      await onSelectList(list);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add item.');
    } finally {
      setSavingListId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center">
      <button
        aria-label="Close list picker"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative w-full overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black sm:max-w-md">
        <div className="border-b border-zinc-800 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
                Add to grocery
              </p>
              <h2 className="mt-1 truncate text-xl font-black text-zinc-100">
                {getPantryItemName(item)}
              </h2>
            </div>
            <button
              aria-label="Close"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              onClick={onClose}
              type="button"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="m6 6 12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>
        </div>

        {error ? (
          <p className="m-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="space-y-2 p-4">
          {loading ? (
            <div className="space-y-2">
              <div className="h-12 rounded-xl bg-zinc-900" />
              <div className="h-12 rounded-xl bg-zinc-900" />
            </div>
          ) : lists.length === 0 ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-400">
              No grocery lists are available for this household.
            </p>
          ) : (
            lists.map((list) => (
              <button
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left hover:border-blue-500/50 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={savingListId !== null}
                key={list.id}
                onClick={() => void handleSelectList(list)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-zinc-100">
                    {list.name}
                  </span>
                  {list.is_default ? (
                    <span className="mt-0.5 block text-xs font-semibold text-blue-300">
                      Default list
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm font-semibold text-zinc-400">
                  {savingListId === list.id ? 'Adding...' : 'Add'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
