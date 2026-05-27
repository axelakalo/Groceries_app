import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useActiveHousehold } from '../household/useActiveHousehold';
import {
  addItem,
  attachGroceryItemProfile,
  createGroceryList,
  deleteGroceryList,
  deleteItem,
  getDefaultGroceryList,
  listGroceryLists,
  listItems,
  renameGroceryList,
  toggleChecked,
  updateItem,
  type GroceryItem,
  type GroceryItemInput,
  type GroceryItemPatch,
  type GroceryList,
} from '../../services/groceryService';

interface UseGroceryItemsResult {
  items: GroceryItem[];
  lists: GroceryList[];
  list: GroceryList | null;
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  selectList: (listId: string) => Promise<void>;
  createList: (name: string) => Promise<void>;
  renameList: (id: string, name: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  addGroceryItem: (item: GroceryItemInput) => Promise<void>;
  updateGroceryItem: (id: string, patch: GroceryItemPatch) => Promise<void>;
  toggleGroceryItem: (item: GroceryItem) => Promise<void>;
  resetCheckedItems: () => Promise<void>;
  deleteGroceryItem: (id: string) => Promise<void>;
}

function sortItems(items: GroceryItem[]) {
  return [...items].sort((a, b) => {
    if (a.is_checked !== b.is_checked) {
      return a.is_checked ? 1 : -1;
    }

    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

function getGroceryItemsCacheKey(householdId: string) {
  return `pantrysync.groceryItems.${householdId}`;
}

function readCachedGroceryItems(householdId: string | null) {
  if (!householdId) {
    return [];
  }

  try {
    const cached = localStorage.getItem(getGroceryItemsCacheKey(householdId));
    return cached ? (JSON.parse(cached) as GroceryItem[]) : [];
  } catch {
    return [];
  }
}

function writeCachedGroceryItems(householdId: string, items: GroceryItem[]) {
  localStorage.setItem(getGroceryItemsCacheKey(householdId), JSON.stringify(items));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong with the grocery list.';
}

export function useGroceryItems(): UseGroceryItemsResult {
  const { activeHousehold } = useActiveHousehold();
  const householdId = activeHousehold?.id ?? null;
  const [items, setItems] = useState<GroceryItem[]>(() =>
    readCachedGroceryItems(householdId),
  );
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [list, setList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    if (!householdId) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const groceryLists = await listGroceryLists(householdId);
      const nextList =
        groceryLists.find((groceryList) => groceryList.id === list?.id) ??
        groceryLists.find((groceryList) => groceryList.is_default) ??
        groceryLists[0] ??
        (await getDefaultGroceryList(householdId));
      const groceryItems = await listItems(nextList.id);
      const sorted = sortItems(groceryItems);
      setLists(groceryLists.length > 0 ? groceryLists : [nextList]);
      setList(nextList);
      setItems(sorted);
      writeCachedGroceryItems(householdId, sorted);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [householdId, list?.id]);

  useEffect(() => {
    if (!householdId) {
      return;
    }

    const activeHouseholdId = householdId;
    let cancelled = false;

    async function loadInitialItems() {
      try {
        const groceryLists = await listGroceryLists(activeHouseholdId);
        const defaultList =
          groceryLists.find((groceryList) => groceryList.is_default) ??
          groceryLists[0] ??
          (await getDefaultGroceryList(activeHouseholdId));
        const groceryItems = await listItems(defaultList.id);

        if (!cancelled) {
          const sorted = sortItems(groceryItems);
          setLists(groceryLists.length > 0 ? groceryLists : [defaultList]);
          setList(defaultList);
          setItems(sorted);
          writeCachedGroceryItems(activeHouseholdId, sorted);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialItems();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  useEffect(() => {
    if (!householdId || !list) {
      return undefined;
    }

    const activeListId = list.id;
    const channel = supabase
      .channel(`grocery-items:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grocery_items',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setItems((currentItems) => {
              const deleted = payload.old as Partial<GroceryItem>;
              return currentItems.filter((item) => item.id !== deleted.id);
            });
            return;
          }

          const incoming = payload.new as GroceryItem;

          if (incoming.list_id !== activeListId) {
            return;
          }

          void attachGroceryItemProfile(incoming)
            .then((nextItem) => {
              setItems((currentItems) => {
                const existing = currentItems.some((item) => item.id === nextItem.id);
                const nextItems = existing
                  ? currentItems.map((item) =>
                      item.id === nextItem.id
                        ? {
                            ...nextItem,
                            added_by_display_name:
                              nextItem.added_by_display_name ??
                              item.added_by_display_name ??
                              null,
                          }
                        : item,
                    )
                  : [...currentItems, nextItem];

                const sorted = sortItems(nextItems);
                writeCachedGroceryItems(householdId, sorted);
                return sorted;
              });
            })
            .catch(() => undefined);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, list]);

  const addGroceryItem = useCallback(
    async (item: GroceryItemInput) => {
      if (!householdId || !list) {
        setError('The default grocery list is not ready yet.');
        return;
      }

      setError('');

      try {
        const created = await addItem({
          householdId,
          listId: list.id,
          item,
        });
        setItems((currentItems) => {
          const sorted = sortItems([created, ...currentItems]);
          writeCachedGroceryItems(householdId, sorted);
          return sorted;
        });
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw new Error(message, { cause: err });
      }
    },
    [householdId, list],
  );

  const selectList = useCallback(
    async (listId: string) => {
      const nextList = lists.find((groceryList) => groceryList.id === listId);

      if (!nextList) {
        return;
      }

      setList(nextList);
      setLoading(true);
      setError('');

      try {
        const groceryItems = await listItems(nextList.id);
        const sorted = sortItems(groceryItems);
        setItems(sorted);
        writeCachedGroceryItems(nextList.household_id, sorted);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [lists],
  );

  const createList = useCallback(
    async (name: string) => {
      if (!householdId) {
        return;
      }

      const created = await createGroceryList(householdId, name);
      setLists((currentLists) => [...currentLists, created]);
      setList(created);
      setItems([]);
      writeCachedGroceryItems(householdId, []);
    },
    [householdId],
  );

  const renameList = useCallback(
    async (id: string, name: string) => {
      const renamed = await renameGroceryList(id, name);
      setLists((currentLists) =>
        currentLists.map((l) => (l.id === id ? renamed : l)),
      );
      // If the renamed list is active, keep list ref in sync
      setList((current) => (current?.id === id ? renamed : current));
    },
    [],
  );

  const deleteList = useCallback(
    async (id: string) => {
      await deleteGroceryList(id);
      const nextLists = lists.filter((groceryList) => groceryList.id !== id);
      setLists(nextLists);
      const nextList =
        nextLists.find((groceryList) => groceryList.is_default) ?? nextLists[0] ?? null;
      setList(nextList);
      const nextItems = nextList ? sortItems(await listItems(nextList.id)) : [];
      setItems(nextItems);

      if (householdId) {
        writeCachedGroceryItems(householdId, nextItems);
      }
    },
    [householdId, lists],
  );

  const updateGroceryItem = useCallback(
    async (id: string, patch: GroceryItemPatch) => {
      setError('');

      try {
        const updated = await updateItem(id, patch);
        setItems((currentItems) => {
          const sorted = sortItems(
            currentItems.map((item) =>
              item.id === id
                ? {
                    ...updated,
                    added_by_display_name:
                      item.added_by_display_name ??
                      updated.added_by_display_name ??
                      null,
                  }
                : item,
            ),
          );
          writeCachedGroceryItems(updated.household_id, sorted);
          return sorted;
        });
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw new Error(message, { cause: err });
      }
    },
    [],
  );

  const toggleGroceryItem = useCallback(async (item: GroceryItem) => {
    const nextChecked = !item.is_checked;
    let previousItems: GroceryItem[] = [];

    setError('');
    setItems((currentItems) =>
      {
        previousItems = currentItems;

        const sorted = sortItems(
          currentItems.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  is_checked: nextChecked,
                  checked_at: nextChecked ? new Date().toISOString() : null,
                }
              : currentItem,
          ),
        );
        writeCachedGroceryItems(item.household_id, sorted);
        return sorted;
      },
    );

    try {
      const updated = await toggleChecked(item.id, nextChecked);
      setItems((currentItems) => {
        const sorted = sortItems(
          currentItems.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...updated,
                  added_by_display_name:
                    currentItem.added_by_display_name ??
                    updated.added_by_display_name ??
                    null,
                }
              : currentItem,
          ),
        );
        writeCachedGroceryItems(updated.household_id, sorted);
        return sorted;
      });
    } catch (err) {
      setItems(previousItems);
      setError(`Could not update item. ${getErrorMessage(err)}`);
    }
  }, []);

  const resetCheckedItems = useCallback(async () => {
    const checkedItems = items.filter((item) => item.is_checked);

    if (checkedItems.length === 0) {
      return;
    }

    setError('');

    try {
      const updatedItems = await Promise.all(
        checkedItems.map((item) => toggleChecked(item.id, false)),
      );
      const updatedItemsById = new Map(
        updatedItems.map((item) => [item.id, item]),
      );

      setItems((currentItems) => {
        const sorted = sortItems(
          currentItems.map((item) =>
            updatedItemsById.get(item.id)
              ? {
                  ...item,
                  ...updatedItemsById.get(item.id),
                  added_by_display_name:
                    item.added_by_display_name ??
                    updatedItemsById.get(item.id)?.added_by_display_name ??
                    null,
                }
              : item,
          ),
        );

        if (householdId) {
          writeCachedGroceryItems(householdId, sorted);
        }

        return sorted;
      });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, [householdId, items]);

  const deleteGroceryItem = useCallback(async (id: string) => {
    setError('');

    try {
      await deleteItem(id);
      setItems((currentItems) => {
        const nextItems = currentItems.filter((item) => item.id !== id);

        if (householdId) {
          writeCachedGroceryItems(householdId, nextItems);
        }

        return nextItems;
      });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, [householdId]);

  const sortedItems = useMemo(() => sortItems(items), [items]);

  return {
    items: sortedItems,
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
  };
}
