import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveHousehold } from '../household/useActiveHousehold';
import {
  addPantryItem,
  addAgain,
  deletePantryItem,
  listPantryItems,
  markDiscardedWithActivity,
  markUsedWithActivity,
  restoreWithActivity,
  updatePantryItem,
  type PantryItem,
  type PantryItemInput,
  type PantryItemPatch,
} from '../../services/pantryService';

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong with the pantry.';
}

function sortItems(items: PantryItem[]) {
  return [...items].sort((a, b) => {
    const activeScore = Number(a.status !== 'active') - Number(b.status !== 'active');

    if (activeScore !== 0) {
      return activeScore;
    }

    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

function getPantryCacheKey(householdId: string) {
  return `pantrysync.pantryItems.${householdId}`;
}

function readCachedPantryItems(householdId: string | null) {
  if (!householdId) {
    return [];
  }

  try {
    const cached = localStorage.getItem(getPantryCacheKey(householdId));
    return cached ? (JSON.parse(cached) as PantryItem[]) : [];
  } catch {
    return [];
  }
}

function writeCachedPantryItems(householdId: string, items: PantryItem[]) {
  localStorage.setItem(getPantryCacheKey(householdId), JSON.stringify(items));
}

export function usePantryItems() {
  const { activeHousehold } = useActiveHousehold();
  const householdId = activeHousehold?.id ?? null;
  const [items, setItems] = useState<PantryItem[]>(() =>
    readCachedPantryItems(householdId),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    if (!householdId) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const pantryItems = await listPantryItems(householdId);
      const sorted = sortItems(pantryItems);
      setItems(sorted);
      writeCachedPantryItems(householdId, sorted);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (!householdId) {
      return;
    }

    const activeHouseholdId = householdId;
    let cancelled = false;

    async function load() {
      try {
        const pantryItems = await listPantryItems(activeHouseholdId);

        if (!cancelled) {
          const sorted = sortItems(pantryItems);
          setItems(sorted);
          writeCachedPantryItems(activeHouseholdId, sorted);
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

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  const addItem = useCallback(
    async (item: PantryItemInput) => {
      if (!householdId) {
        throw new Error('No active household is available.');
      }

      try {
        const created = await addPantryItem({ householdId, item });
        setItems((currentItems) => {
          const sorted = sortItems([created, ...currentItems]);
          writeCachedPantryItems(householdId, sorted);
          return sorted;
        });
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw new Error(message, { cause: err });
      }
    },
    [householdId],
  );

  const addItemAgain = useCallback(async (item: PantryItem) => {
    try {
      const created = await addAgain(item);
      setItems((currentItems) => {
        const sorted = sortItems([created, ...currentItems]);
        writeCachedPantryItems(item.household_id, sorted);
        return sorted;
      });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, []);

  const updateItem = useCallback(async (id: string, patch: PantryItemPatch) => {
    try {
      const updated = await updatePantryItem(id, patch);
      setItems((currentItems) => {
        const sorted = sortItems(
          currentItems.map((item) => (item.id === id ? updated : item)),
        );
        writeCachedPantryItems(updated.household_id, sorted);
        return sorted;
      });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await deletePantryItem(id);
      setItems((currentItems) => {
        const nextItems = currentItems.filter((item) => item.id !== id);

        if (householdId) {
          writeCachedPantryItems(householdId, nextItems);
        }

        return nextItems;
      });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, [householdId]);

  const markItemUsed = useCallback(async (id: string) => {
    try {
      const item = items.find((currentItem) => currentItem.id === id);

      if (!item) {
        throw new Error('Pantry item was not found.');
      }

      const updated = await markUsedWithActivity(item);
      setItems((currentItems) => {
        const sorted = sortItems(
          currentItems.map((item) => (item.id === id ? updated : item)),
        );
        writeCachedPantryItems(updated.household_id, sorted);
        return sorted;
      });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, [items]);

  const markItemDiscarded = useCallback(async (id: string) => {
    try {
      const item = items.find((currentItem) => currentItem.id === id);

      if (!item) {
        throw new Error('Pantry item was not found.');
      }

      const updated = await markDiscardedWithActivity(item);
      setItems((currentItems) => {
        const sorted = sortItems(
          currentItems.map((item) => (item.id === id ? updated : item)),
        );
        writeCachedPantryItems(updated.household_id, sorted);
        return sorted;
      });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, [items]);

  const restoreItem = useCallback(async (id: string) => {
    try {
      const item = items.find((currentItem) => currentItem.id === id);

      if (!item) {
        throw new Error('Pantry item was not found.');
      }

      const updated = await restoreWithActivity(item);
      setItems((currentItems) => {
        const sorted = sortItems(
          currentItems.map((item) => (item.id === id ? updated : item)),
        );
        writeCachedPantryItems(updated.household_id, sorted);
        return sorted;
      });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, [items]);

  return useMemo(
    () => ({
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
    }),
    [
      addItem,
      addItemAgain,
      deleteItem,
      error,
      items,
      loading,
      markItemDiscarded,
      markItemUsed,
      refetch,
      restoreItem,
      updateItem,
    ],
  );
}
