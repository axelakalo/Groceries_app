import { supabase } from '../lib/supabaseClient';
import type { GroceryItem, GroceryItemInput } from './groceryService';

export interface FavoriteItem {
  id: string;
  household_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: string | null;
  source_type: 'manual' | 'auto';
  created_at: string;
  updated_at: string;
}

export async function listFavorites(householdId: string): Promise<FavoriteItem[]> {
  const { data, error } = await supabase
    .from('favorite_items')
    .select('*')
    .eq('household_id', householdId)
    .order('name', { ascending: true })
    .returns<FavoriteItem[]>();

  if (error) {
    throw error;
  }

  return data;
}

export async function addFavorite(
  householdId: string,
  item: GroceryItemInput,
): Promise<FavoriteItem> {
  const name = item.name.trim();
  const { data: existing, error: findError } = await supabase
    .from('favorite_items')
    .select('id')
    .eq('household_id', householdId)
    .ilike('name', name)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('favorite_items')
      .update({
        name,
        quantity: item.quantity,
        unit: item.unit?.trim() || null,
        category: item.category?.trim() || null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as FavoriteItem;
  }

  const { data, error } = await supabase
    .from('favorite_items')
    .insert({
      household_id: householdId,
      name,
      quantity: item.quantity,
      unit: item.unit?.trim() || null,
      category: item.category?.trim() || null,
      source_type: 'manual',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as FavoriteItem;
}

export async function removeFavorite(id: string): Promise<void> {
  const { error } = await supabase.from('favorite_items').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export async function toggleFavorite(
  householdId: string,
  item: GroceryItem,
  currentFavorite?: FavoriteItem,
): Promise<{ favorite: FavoriteItem | null; isFavorite: boolean }> {
  if (currentFavorite) {
    await removeFavorite(currentFavorite.id);
    return { favorite: null, isFavorite: false };
  }

  const favorite = await addFavorite(householdId, {
    name: item.name,
    quantity: Number(item.quantity),
    unit: item.unit ?? undefined,
    category: item.category ?? undefined,
    notes: item.notes ?? undefined,
  });

  return { favorite, isFavorite: true };
}
