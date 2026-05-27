import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

function normalizeOptionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
    const body = (await request.json()) as {
      barcode?: string;
      name?: string;
      brand?: string | null;
      category?: string | null;
    };

    if (!body.barcode || !isValidBarcode(body.barcode)) {
      return jsonResponse({ error: 'Invalid barcode' }, 400);
    }

    if (!body.name?.trim()) {
      return jsonResponse({ error: 'Product name is required' }, 400);
    }

    const supabase = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const product = {
      barcode: normalizeBarcode(body.barcode),
      name: body.name.trim(),
      brand: normalizeOptionalText(body.brand),
      image_url: null,
      category: normalizeOptionalText(body.category),
      source: 'manual',
      raw_source: null,
    };

    const { data, error } = await supabase
      .from('products')
      .upsert(product, { onConflict: 'barcode' })
      .select()
      .single();

    if (error || !data) {
      return jsonResponse({ error: 'Product creation failed' }, 500);
    }

    return jsonResponse({ product: data });
  } catch {
    return jsonResponse({ error: 'Unexpected product creation error' }, 500);
  }
});
