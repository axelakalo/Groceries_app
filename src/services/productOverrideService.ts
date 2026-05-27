import { supabase } from '../lib/supabaseClient';
import type { StorageLocation } from '../lib/constants';

export interface HouseholdProductOverride {
  id: string;
  household_id: string;
  product_id: string;
  custom_name: string | null;
  default_category: string | null;
  default_storage_location: StorageLocation | null;
  default_unit: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductOverrideInput {
  custom_name?: string | null;
  default_category?: string | null;
  default_storage_location?: StorageLocation | null;
  default_unit?: string | null;
}

export async function getOverride(
  householdId: string,
  productId: string,
): Promise<HouseholdProductOverride | null> {
  const { data, error } = await supabase
    .from('household_product_overrides')
    .select('*')
    .eq('household_id', householdId)
    .eq('product_id', productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as HouseholdProductOverride | null;
}

export async function saveOverride(
  householdId: string,
  productId: string,
  overrides: ProductOverrideInput,
): Promise<HouseholdProductOverride> {
  const { data, error } = await supabase
    .from('household_product_overrides')
    .upsert(
      {
        household_id: householdId,
        product_id: productId,
        custom_name: overrides.custom_name?.trim() || null,
        default_category: overrides.default_category?.trim() || null,
        default_storage_location: overrides.default_storage_location ?? null,
        default_unit: overrides.default_unit?.trim() || null,
      },
      { onConflict: 'household_id,product_id' },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as HouseholdProductOverride;
}
