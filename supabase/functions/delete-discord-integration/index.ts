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

function getEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') ?? '';
  const [scheme, token] = authorization.split(' ');

  return scheme.toLowerCase() === 'bearer' && token ? token : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const jwt = getBearerToken(request);

    if (!jwt) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = (await request.json()) as { household_id?: string };

    if (!body.household_id) {
      return jsonResponse({ error: 'household_id is required' }, 400);
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

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !userData.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', body.household_id)
      .eq('user_id', userData.user.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (membershipError) {
      return jsonResponse({ error: 'Could not verify household ownership' }, 500);
    }

    if (!membership) {
      return jsonResponse({ error: 'Forbidden: owner role required' }, 403);
    }

    const { error: deleteError } = await supabase
      .from('discord_integrations')
      .delete()
      .eq('household_id', body.household_id);

    if (deleteError) {
      return jsonResponse({ error: 'Could not delete Discord webhook' }, 500);
    }

    const { error: preferencesError } = await supabase
      .from('notification_preferences')
      .update({ discord_enabled: false })
      .eq('household_id', body.household_id);

    if (preferencesError) {
      return jsonResponse({ error: 'Could not update notification preferences' }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Unexpected Discord integration delete error',
      },
      500,
    );
  }
});
