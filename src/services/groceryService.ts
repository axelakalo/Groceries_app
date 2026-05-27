import { supabase } from '../lib/supabaseClient';
import { formatDisplayDate, getDaysUntil } from '../lib/dates';
import {
  getPantryItemName,
  type PantryItem,
} from './pantryService';
import { logEvent } from './activityService';

export interface GroceryList {
  id: string;
  household_id: string;
  name: string;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroceryItem {
  id: string;
  household_id: string;
  list_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: string | null;
  notes: string | null;
  is_checked: boolean;
  added_by: string;
  checked_by: string | null;
  checked_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  added_by_display_name?: string | null;
}

export interface GroceryItemInput {
  name: string;
  quantity: number;
  unit?: string;
  category?: string;
  notes?: string;
}

export type GroceryItemPatch = Partial<GroceryItemInput>;

export class DuplicateGroceryItemError extends Error {
  readonly itemName: string;

  constructor(itemName: string) {
    super('Already on your list. Add another?');
    this.itemName = itemName;
    this.name = 'DuplicateGroceryItemError';
  }
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('You need to be signed in to update the grocery list.');
  }

  return data.user.id;
}

async function getProfileDisplayNames(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)];

  if (uniqueUserIds.length === 0) {
    return new Map<string, string | null>();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', uniqueUserIds)
    .returns<{ id: string; display_name: string | null }[]>();

  if (error) {
    throw error;
  }

  return new Map(data.map((profile) => [profile.id, profile.display_name]));
}

export async function attachGroceryItemProfile(
  item: GroceryItem,
): Promise<GroceryItem> {
  const displayNamesByUserId = await getProfileDisplayNames([item.added_by]);

  return {
    ...item,
    added_by_display_name: displayNamesByUserId.get(item.added_by) ?? null,
  };
}

async function attachGroceryItemProfiles(
  items: GroceryItem[],
): Promise<GroceryItem[]> {
  const displayNamesByUserId = await getProfileDisplayNames(
    items.map((item) => item.added_by),
  );

  return items.map((item) => ({
    ...item,
    added_by_display_name: displayNamesByUserId.get(item.added_by) ?? null,
  }));
}

export async function getDefaultGroceryList(
  householdId: string,
): Promise<GroceryList> {
  const { data, error } = await supabase
    .from('grocery_lists')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_default', true)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Default grocery list was not found.');
  }

  return data as GroceryList;
}

export async function listGroceryLists(householdId: string): Promise<GroceryList[]> {
  const { data, error } = await supabase
    .from('grocery_lists')
    .select('*')
    .eq('household_id', householdId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .returns<GroceryList[]>();

  if (error) {
    throw error;
  }

  return data;
}

export async function createGroceryList(
  householdId: string,
  name: string,
): Promise<GroceryList> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('grocery_lists')
    .insert({
      household_id: householdId,
      name: name.trim(),
      is_default: false,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as GroceryList;
}

export async function deleteGroceryList(id: string): Promise<void> {
  const { error } = await supabase.from('grocery_lists').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export async function renameGroceryList(id: string, name: string): Promise<GroceryList> {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error('List name cannot be empty.');
  }

  const { data, error } = await supabase
    .from('grocery_lists')
    .update({ name: trimmed })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as GroceryList;
}

export async function listItems(listId: string): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from('grocery_items')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: false })
    .returns<GroceryItem[]>();

  if (error) {
    throw error;
  }

  return attachGroceryItemProfiles(data);
}

export async function addItem({
  householdId,
  listId,
  item,
}: {
  householdId: string;
  listId: string;
  item: GroceryItemInput;
}): Promise<GroceryItem> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('grocery_items')
    .insert({
      household_id: householdId,
      list_id: listId,
      name: item.name.trim(),
      quantity: item.quantity,
      unit: normalizeOptionalText(item.unit),
      category: normalizeOptionalText(item.category),
      notes: normalizeOptionalText(item.notes),
      added_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Grocery item was not created.');
  }

  const created = await attachGroceryItemProfile(data as GroceryItem);
  void logEvent(householdId, 'grocery_item_added', 'grocery_item', created.id, {
    name: created.name,
  });

  return created;
}

export async function updateItem(
  id: string,
  patch: GroceryItemPatch,
): Promise<GroceryItem> {
  const update: Partial<Pick<GroceryItem, 'name' | 'quantity' | 'unit' | 'category' | 'notes'>> = {};

  if (patch.name !== undefined) {
    update.name = patch.name.trim();
  }

  if (patch.quantity !== undefined) {
    update.quantity = patch.quantity;
  }

  if (patch.unit !== undefined) {
    update.unit = normalizeOptionalText(patch.unit);
  }

  if (patch.category !== undefined) {
    update.category = normalizeOptionalText(patch.category);
  }

  if (patch.notes !== undefined) {
    update.notes = normalizeOptionalText(patch.notes);
  }

  const { data, error } = await supabase
    .from('grocery_items')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Grocery item was not updated.');
  }

  return data as GroceryItem;
}

export async function toggleChecked(
  id: string,
  isChecked: boolean,
): Promise<GroceryItem> {
  const userId = isChecked ? await getCurrentUserId() : null;

  const { data, error } = await supabase
    .from('grocery_items')
    .update({
      is_checked: isChecked,
      checked_by: userId,
      checked_at: isChecked ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Grocery item was not updated.');
  }

  const updated = data as GroceryItem;
  void logEvent(
    updated.household_id,
    isChecked ? 'grocery_item_checked' : 'grocery_item_unchecked',
    'grocery_item',
    updated.id,
    { name: updated.name },
  );

  return updated;
}

export async function deleteItem(id: string): Promise<void> {
  const { data: existing } = await supabase
    .from('grocery_items')
    .select('household_id, name')
    .eq('id', id)
    .maybeSingle<{ household_id: string; name: string }>();

  const { error } = await supabase.from('grocery_items').delete().eq('id', id);

  if (error) {
    throw error;
  }

  if (existing) {
    void logEvent(existing.household_id, 'grocery_item_deleted', 'grocery_item', id, {
      name: existing.name,
    });
  }
}

export async function getUncheckedItemCount(householdId: string): Promise<number> {
  const defaultList = await getDefaultGroceryList(householdId);
  const { count, error } = await supabase
    .from('grocery_items')
    .select('id', { count: 'exact', head: true })
    .eq('list_id', defaultList.id)
    .eq('is_checked', false);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function addFromPantryItem(
  pantryItem: PantryItem,
  options: { allowDuplicate?: boolean; listId?: string } = {},
): Promise<GroceryItem> {
  const name = getPantryItemName(pantryItem).trim();

  if (!name) {
    throw new Error('Pantry item does not have a name.');
  }

  const listId =
    options.listId ?? (await getDefaultGroceryList(pantryItem.household_id)).id;

  if (!options.allowDuplicate) {
    const { data: uncheckedItems, error } = await supabase
      .from('grocery_items')
      .select('name')
      .eq('list_id', listId)
      .eq('is_checked', false);

    if (error) {
      throw error;
    }

    const hasDuplicate = (uncheckedItems ?? []).some(
      (item) => item.name.trim().toLowerCase() === name.toLowerCase(),
    );

    if (hasDuplicate) {
      throw new DuplicateGroceryItemError(name);
    }
  }

  const expirationContext = pantryItem.expiration_date
    ? getExpirationContext(pantryItem.expiration_date)
    : 'has no expiration date';

  const created = await addItem({
    householdId: pantryItem.household_id,
    listId,
    item: {
      name,
      quantity: Number(pantryItem.quantity),
      unit: pantryItem.unit ?? undefined,
      category: pantryItem.category ?? pantryItem.products?.category ?? undefined,
      notes: `Restock - ${name} ${expirationContext}`,
    },
  });

  void logEvent(
    pantryItem.household_id,
    'pantry_item_added_to_grocery',
    'pantry_item',
    pantryItem.id,
    { name },
  );

  return created;
}

function getExpirationContext(expirationDate: string) {
  const daysUntil = getDaysUntil(expirationDate);

  if (daysUntil < 0) {
    const daysAgo = Math.abs(daysUntil);
    return `expired ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
  }

  if (daysUntil === 0) {
    return 'expires today';
  }

  return `expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${formatDisplayDate(expirationDate)})`;
}
