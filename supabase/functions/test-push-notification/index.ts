import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
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

async function sendPush(subscription: PushSubscriptionRow) {
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify({
      title: 'PantrySync Push Test',
      body: 'Push notifications are working.',
      url: '/app',
    }),
  );
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

    webpush.setVapidDetails(
      getEnv('VAPID_SUBJECT'),
      getEnv('VAPID_PUBLIC_KEY'),
      getEnv('VAPID_PRIVATE_KEY'),
    );

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

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('household_id', body.household_id)
      .eq('user_id', userData.user.id)
      .eq('enabled', true)
      .returns<PushSubscriptionRow[]>();

    if (subscriptionsError) {
      return jsonResponse({ error: 'Could not load push subscriptions' }, 500);
    }

    if (!subscriptions.length) {
      return jsonResponse({ error: 'No enabled push subscription found' }, 404);
    }

    const results = await Promise.allSettled(
      subscriptions.map((subscription) => sendPush(subscription)),
    );
    const sent = results.filter((result) => result.status === 'fulfilled').length;

    if (sent === 0) {
      return jsonResponse({ error: 'Push delivery failed' }, 500);
    }

    return jsonResponse({ ok: true, sent });
  } catch (err) {
    return jsonResponse(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Unexpected push notification test error',
      },
      500,
    );
  }
});
