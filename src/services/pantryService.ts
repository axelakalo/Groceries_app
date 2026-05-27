import { supabase } from '../lib/supabaseClient';
import type { ItemStatus, StorageLocation } from '../lib/constants';
import { normalizeDateForDb } from '../lib/dates';
import { logEvent } from './activityService';

export interface PantryProduct {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  category: string | null;
}

export interface PantryItem {
  id: string;
  household_id: string;
  product_id: string | null;
  custom_name: string | null;
  quantity: number;
  unit: string | null;
  category: string | null;
  storage_location: StorageLocation;
  bought_date: string;
  expiration_date: string | null;
  has_expiration: boolean;
  notes: string | null;
  status: ItemStatus;
  track_quantity: boolean;
  low_stock_threshold: number | null;
  added_by: string;
  used_at: string | null;
  discarded_at: string | null;
  created_at: string;
  updated_at: string;
  products?: PantryProduct | null;
}

export interface PantryItemInput {
  name: string;
  product_id?: string | null;
  quantity: number;
  unit?: string;
  category?: string;
  storage_location: StorageLocation;
  bought_date: string;
  has_expiration: boolean;
  expiration_date: string | null;
  notes?: string;
  track_quantity?: boolean;
  low_stock_threshold?: number | null;
}

export type PantryItemPatch = Partial<PantryItemInput>;

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
    throw new Error('You need to be signed in to update the pantry.');
  }

  return data.user.id;
}

export function getPantryItemName(item: PantryItem) {
  return item.custom_name ?? item.products?.name ?? 'Unnamed item';
}

export async function listPantryItems(
  householdId: string,
): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from('pantry_items')
    .select(
      `
      *,
      products(id, name, brand, image_url, category)
    `,
    )
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const items = (data ?? []) as PantryItem[];
  const productIds = [
    ...new Set(
      items
        .map((item) => item.product_id)
        .filter((productId): productId is string => Boolean(productId)),
    ),
  ];

  if (productIds.length === 0) {
    return items;
  }

  const { data: overrides } = await supabase
    .from('household_product_overrides')
    .select('product_id, custom_name, default_category')
    .eq('household_id', householdId)
    .in('product_id', productIds)
    .returns<
      {
        product_id: string;
        custom_name: string | null;
        default_category: string | null;
      }[]
    >();

  const overridesByProductId = new Map(
    (overrides ?? []).map((override) => [override.product_id, override]),
  );

  return items.map((item) => {
    const override = item.product_id
      ? overridesByProductId.get(item.product_id)
      : undefined;

    if (!override) {
      return item;
    }

    return {
      ...item,
      category: item.category ?? override.default_category,
      products: item.products
        ? {
            ...item.products,
            name: override.custom_name ?? item.products.name,
            category: override.default_category ?? item.products.category,
          }
        : item.products,
    };
  });
}

export async function addPantryItem({
  householdId,
  item,
}: {
  householdId: string;
  item: PantryItemInput;
}): Promise<PantryItem> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('pantry_items')
    .insert({
      household_id: householdId,
      product_id: item.product_id ?? null,
      custom_name: item.name.trim(),
      quantity: item.quantity,
      unit: normalizeOptionalText(item.unit),
      category: normalizeOptionalText(item.category),
      storage_location: item.storage_location,
      bought_date: item.bought_date,
      has_expiration: item.has_expiration,
      expiration_date: item.has_expiration ? item.expiration_date : null,
      notes: normalizeOptionalText(item.notes),
      track_quantity: item.track_quantity ?? false,
      low_stock_threshold: item.track_quantity ? item.low_stock_threshold ?? null : null,
      added_by: userId,
    })
    .select('*, products(id, name, brand, image_url, category)')
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Pantry item was not created.');
  }

  const created = data as PantryItem;
  void logEvent(householdId, 'pantry_item_added', 'pantry_item', created.id, {
    name: getPantryItemName(created),
  });

  return created;
}

export async function addAgain(
  item: PantryItem,
  expirationDate: string | null = item.expiration_date,
): Promise<PantryItem> {
  return addPantryItem({
    householdId: item.household_id,
    item: {
      name: getPantryItemName(item),
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit: item.unit ?? undefined,
      category: item.category ?? item.products?.category ?? undefined,
      storage_location: item.storage_location,
      bought_date: normalizeDateForDb(new Date()),
      has_expiration: item.has_expiration,
      expiration_date: item.has_expiration ? expirationDate : null,
      notes: item.notes ?? undefined,
      track_quantity: item.track_quantity,
      low_stock_threshold: item.low_stock_threshold,
    },
  });
}

export async function updatePantryItem(
  id: string,
  patch: PantryItemPatch,
): Promise<PantryItem> {
  const update: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    update.custom_name = patch.name.trim();
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

  if (patch.storage_location !== undefined) {
    update.storage_location = patch.storage_location;
  }

  if (patch.bought_date !== undefined) {
    update.bought_date = patch.bought_date;
  }

  if (patch.has_expiration !== undefined) {
    update.has_expiration = patch.has_expiration;
    update.expiration_date = patch.has_expiration ? patch.expiration_date : null;
  } else if (patch.expiration_date !== undefined) {
    update.expiration_date = patch.expiration_date;
  }

  if (patch.notes !== undefined) {
    update.notes = normalizeOptionalText(patch.notes);
  }

  if (patch.track_quantity !== undefined) {
    update.track_quantity = patch.track_quantity;
    update.low_stock_threshold = patch.track_quantity
      ? patch.low_stock_threshold ?? null
      : null;
  } else if (patch.low_stock_threshold !== undefined) {
    update.low_stock_threshold = patch.low_stock_threshold;
  }

  const { data, error } = await supabase
    .from('pantry_items')
    .update(update)
    .eq('id', id)
    .select('*, products(id, name, brand, image_url, category)')
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Pantry item was not updated.');
  }

  return data as PantryItem;
}

export async function deletePantryItem(id: string): Promise<void> {
  const { error } = await supabase.from('pantry_items').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

async function updateStatus(
  id: string,
  patch: Pick<PantryItem, 'status'> & {
    used_at?: string | null;
    discarded_at?: string | null;
  },
): Promise<PantryItem> {
  const { data, error } = await supabase
    .from('pantry_items')
    .update(patch)
    .eq('id', id)
    .select('*, products(id, name, brand, image_url, category)')
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Pantry item status was not updated.');
  }

  return data as PantryItem;
}

export function markUsed(id: string) {
  return updateStatus(id, {
    status: 'used',
    used_at: new Date().toISOString(),
    discarded_at: null,
  });
}

export function markDiscarded(id: string) {
  return updateStatus(id, {
    status: 'discarded',
    discarded_at: new Date().toISOString(),
    used_at: null,
  });
}

export function restore(id: string) {
  return updateStatus(id, {
    status: 'active',
    used_at: null,
    discarded_at: null,
  });
}

export async function markUsedWithActivity(item: PantryItem) {
  const updated = await markUsed(item.id);
  void logEvent(item.household_id, 'pantry_item_used', 'pantry_item', item.id, {
    name: getPantryItemName(item),
  });
  return updated;
}

export async function markDiscardedWithActivity(item: PantryItem) {
  const updated = await markDiscarded(item.id);
  void logEvent(item.household_id, 'pantry_item_discarded', 'pantry_item', item.id, {
    name: getPantryItemName(item),
  });
  return updated;
}

export async function restoreWithActivity(item: PantryItem) {
  const updated = await restore(item.id);
  void logEvent(item.household_id, 'pantry_item_restored', 'pantry_item', item.id, {
    name: getPantryItemName(item),
  });
  return updated;
}

export async function getLowStockItems(householdId: string): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from('pantry_items')
    .select('*, products(id, name, brand, image_url, category)')
    .eq('household_id', householdId)
    .eq('status', 'active')
    .eq('track_quantity', true)
    .not('low_stock_threshold', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as PantryItem[]).filter(
    (item) =>
      item.low_stock_threshold !== null &&
      Number(item.quantity) <= Number(item.low_stock_threshold),
  );
}
