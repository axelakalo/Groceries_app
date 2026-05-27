import { normalizeBarcode, isValidBarcode } from '../lib/barcode';
import { supabase } from '../lib/supabaseClient';

export interface Product {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  image_url: string | null;
  category: string | null;
  source: 'manual' | 'open_food_facts';
  raw_source: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type ProductLookupSource =
  | 'local'
  | 'open_food_facts'
  | 'not_found'
  | 'lookup_failed';

export interface ProductLookupResult {
  product: Product | null;
  source: ProductLookupSource;
}

export interface ManualProductInput {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
}

function requireValidBarcode(value: string) {
  if (!isValidBarcode(value)) {
    throw new Error('Barcode must be 8 to 14 digits.');
  }

  return normalizeBarcode(value);
}

export async function lookupByBarcode(
  barcode: string,
): Promise<ProductLookupResult> {
  const normalizedBarcode = requireValidBarcode(barcode);
  const { data, error } = await supabase.functions.invoke<ProductLookupResult>(
    'lookup-product',
    {
      body: { barcode: normalizedBarcode },
    },
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Product lookup returned no data.');
  }

  return data;
}

export async function createManualProduct(
  input: ManualProductInput,
): Promise<Product> {
  const normalizedBarcode = requireValidBarcode(input.barcode);

  if (!input.name.trim()) {
    throw new Error('Product name is required.');
  }

  const { data, error } = await supabase.functions.invoke<{ product: Product }>(
    'create-manual-product',
    {
      body: {
        barcode: normalizedBarcode,
        name: input.name.trim(),
        brand: input.brand?.trim() || null,
        category: input.category?.trim() || null,
      },
    },
  );

  if (error) {
    throw error;
  }

  if (!data?.product) {
    throw new Error('Manual product creation returned no product.');
  }

  return data.product;
}
