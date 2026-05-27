import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_MENTION_ROLE_ID = '1509203591334858804';

interface DiscordWebhookMeta {
  id: string;
  guild_id: string | null;
  channel_id: string | null;
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

function normalizeWebhookUrl(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidDiscordWebhookUrl(value: string) {
  return /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/u.test(
    value,
  );
}

function normalizeRoleId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isValidRoleId(value: string) {
  return /^[0-9]{17,20}$/u.test(value);
}

async function getWebhookMeta(webhookUrl: string): Promise<DiscordWebhookMeta> {
  const response = await fetch(webhookUrl, { method: 'GET' });

  if (!response.ok) {
    throw new Error('Discord webhook could not be verified.');
  }

  const data = (await response.json()) as Partial<DiscordWebhookMeta>;

  if (!data.id) {
    throw new Error('Discord webhook response was invalid.');
  }

  return {
    id: data.id,
    guild_id: data.guild_id ?? null,
    channel_id: data.channel_id ?? data.id,
  };
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

    const body = (await request.json()) as {
      household_id?: string;
      webhook_url?: unknown;
      enabled?: unknown;
      mention_enabled?: unknown;
      mention_role_id?: unknown;
    };

    if (!body.household_id) {
      return jsonResponse({ error: 'household_id is required' }, 400);
    }

    const webhookUrl = normalizeWebhookUrl(body.webhook_url);

    if (!isValidDiscordWebhookUrl(webhookUrl)) {
      return jsonResponse({ error: 'A valid Discord webhook URL is required' }, 400);
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
      .maybeSingle();

    if (membershipError) {
      return jsonResponse({ error: 'Could not verify household membership' }, 500);
    }

    if (!membership) {
      return jsonResponse({ error: 'Forbidden: household membership required' }, 403);
    }

    const webhookMeta = await getWebhookMeta(webhookUrl);
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
    const mentionEnabled =
      typeof body.mention_enabled === 'boolean' ? body.mention_enabled : true;
    const mentionRoleId =
      normalizeRoleId(body.mention_role_id) ?? DEFAULT_MENTION_ROLE_ID;

    if (mentionEnabled && (!mentionRoleId || !isValidRoleId(mentionRoleId))) {
      return jsonResponse(
        { error: 'Discord mention role ID must be 17-20 digits.' },
        400,
      );
    }

    const { data: integration, error: upsertError } = await supabase
      .from('discord_integrations')
      .upsert(
        {
          household_id: body.household_id,
          guild_id: webhookMeta.guild_id,
          channel_id: webhookMeta.channel_id,
          webhook_url: webhookUrl,
          enabled,
          mention_enabled: mentionEnabled,
          mention_role_id: mentionRoleId,
          created_by: userData.user.id,
        },
        {
          onConflict: 'household_id',
        },
      )
      .select(
        'id, household_id, channel_id, enabled, mention_enabled, mention_role_id, updated_at',
      )
      .single();

    if (upsertError || !integration) {
      return jsonResponse({ error: 'Could not save Discord integration' }, 500);
    }

    const { error: preferencesError } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          household_id: body.household_id,
          user_id: userData.user.id,
          discord_enabled: enabled,
        },
        {
          onConflict: 'household_id,user_id',
        },
      );

    if (preferencesError) {
      return jsonResponse({ error: 'Could not update notification preferences' }, 500);
    }

    return jsonResponse({ integration });
  } catch (err) {
    return jsonResponse(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Unexpected Discord integration save error',
      },
      500,
    );
  }
});
