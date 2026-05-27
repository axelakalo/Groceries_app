import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_MENTION_ROLE_ID = '1509203591334858804';

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

function getAllowedMentions(mentionEnabled: boolean, mentionRoleId: string | null) {
  if (mentionEnabled && mentionRoleId && isValidRoleId(mentionRoleId)) {
    return {
      content: `<@&${mentionRoleId}> ✅ PantrySync Discord reminders are connected.`,
      allowed_mentions: {
        roles: [mentionRoleId],
      },
    };
  }

  return {
    content: 'PantrySync Discord reminders are connected.',
    allowed_mentions: {
      parse: [],
    },
  };
}

async function sendTestMessage(
  webhookUrl: string,
  mentionEnabled: boolean,
  mentionRoleId: string | null,
) {
  const mentionPayload = getAllowedMentions(mentionEnabled, mentionRoleId);
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...mentionPayload,
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed with ${response.status}.`);
  }
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
      mention_enabled?: unknown;
      mention_role_id?: unknown;
    };

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
      .maybeSingle();

    if (membershipError) {
      return jsonResponse({ error: 'Could not verify household membership' }, 500);
    }

    if (!membership) {
      return jsonResponse({ error: 'Forbidden: household membership required' }, 403);
    }

    let webhookUrl = normalizeWebhookUrl(body.webhook_url);
    let mentionEnabled =
      typeof body.mention_enabled === 'boolean' ? body.mention_enabled : true;
    let mentionRoleId = normalizeRoleId(body.mention_role_id) ?? DEFAULT_MENTION_ROLE_ID;

    if (!webhookUrl) {
      const { data: integration, error: integrationError } = await supabase
        .from('discord_integrations')
        .select('webhook_url, mention_enabled, mention_role_id')
        .eq('household_id', body.household_id)
        .maybeSingle();

      if (integrationError) {
        return jsonResponse({ error: 'Could not load Discord integration' }, 500);
      }

      webhookUrl = integration?.webhook_url ?? '';
      mentionEnabled = integration?.mention_enabled ?? true;
      mentionRoleId = integration?.mention_role_id ?? DEFAULT_MENTION_ROLE_ID;
    }

    if (!isValidDiscordWebhookUrl(webhookUrl)) {
      return jsonResponse(
        {
          error:
            'No saved Discord webhook was found. Paste a webhook URL or save one first.',
        },
        400,
      );
    }

    if (mentionEnabled && (!mentionRoleId || !isValidRoleId(mentionRoleId))) {
      return jsonResponse(
        { error: 'Discord mention role ID must be 17-20 digits.' },
        400,
      );
    }

    await sendTestMessage(webhookUrl, mentionEnabled, mentionRoleId);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Unexpected Discord test message error',
      },
      500,
    );
  }
});
