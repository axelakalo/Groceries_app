import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OffProduct {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
  categories_tags?: string[];
}

interface OffResponse {
  status?: number;
  code?: string;
  product?: OffProduct;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeBarcode(value: string) {
  return value.replace(/[\s-]/g, '');
}

function isValidBarcode(value: string) {
  return /^\d{8,14}$/.test(normalizeBarcode(value));
}

function getEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { barcode } = (await request.json()) as { barcode?: string };

    if (!barcode || !isValidBarcode(barcode)) {
      return jsonResponse({ error: 'Invalid barcode' }, 400);
    }

    const normalizedBarcode = normalizeBarcode(barcode);
    const supabase = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const { data: localProduct, error: localError } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', normalizedBarcode)
      .maybeSingle();

    if (localError) {
      return jsonResponse({ error: 'Product lookup failed' }, 500);
    }

    if (localProduct) {
      return jsonResponse({ product: localProduct, source: 'local' });
    }

    let offData: OffResponse;

    try {
      const offResponse = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${normalizedBarcode}.json`,
        {
          headers: {
            'User-Agent': 'PantrySync/1.0 (https://your-domain)',
          },
        },
      );

      if (offResponse.status >= 500) {
        return jsonResponse({ product: null, source: 'lookup_failed' });
      }

      offData = (await offResponse.json()) as OffResponse;
    } catch {
      return jsonResponse({ product: null, source: 'lookup_failed' });
    }

    if (offData.status !== 1 || !offData.product) {
      return jsonResponse({ product: null, source: 'not_found' });
    }

    const product = offData.product;
    const normalizedProduct = {
      barcode: normalizedBarcode,
      name: product.product_name || product.generic_name || 'Unknown product',
      brand: product.brands?.split(',')[0]?.trim() || null,
      image_url: product.image_front_url ?? product.image_url ?? null,
      category: product.categories_tags?.[0]?.replace(/^en:/, '') ?? null,
      source: 'open_food_facts',
      raw_source: {
        off_status: offData.status,
        code: offData.code ?? normalizedBarcode,
      },
    };

    const { data: savedProduct, error: upsertError } = await supabase
      .from('products')
      .upsert(normalizedProduct, { onConflict: 'barcode' })
      .select()
      .single();

    if (upsertError || !savedProduct) {
      return jsonResponse({ error: 'Product lookup failed' }, 500);
    }

    return jsonResponse({
      product: savedProduct,
      source: 'open_food_facts',
    });
  } catch {
    return jsonResponse({ error: 'Unexpected product lookup error' }, 500);
  }
});
