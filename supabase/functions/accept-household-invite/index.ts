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

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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

    const body = (await request.json()) as { raw_token?: string };

    if (!body.raw_token) {
      return jsonResponse({ error: 'raw_token is required' }, 400);
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

    const { data: currentMemberships, error: currentMembershipsError } =
      await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userData.user.id);

    if (currentMembershipsError) {
      return jsonResponse({ error: 'Could not check household membership' }, 500);
    }

    const tokenHash = await sha256Hex(body.raw_token);
    const { data: invite, error: inviteError } = await supabase
      .from('household_invites')
      .select('id, household_id, invited_email, households!inner(name)')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (inviteError) {
      return jsonResponse({ error: 'Could not verify invite' }, 500);
    }

    if (!invite) {
      return jsonResponse({ error: 'Invite not found' }, 404);
    }

    const invitedEmail = invite.invited_email?.toLowerCase();
    const userEmail = userData.user.email?.toLowerCase();

    if (invitedEmail && invitedEmail !== userEmail) {
      return jsonResponse({ error: 'Invite email does not match this account' }, 403);
    }

    const belongsToOtherHousehold = currentMemberships.some(
      (membership) => membership.household_id !== invite.household_id,
    );

    if (belongsToOtherHousehold) {
      return jsonResponse(
        { error: 'This account already belongs to another household' },
        409,
      );
    }

    const { error: memberError } = await supabase
      .from('household_members')
      .upsert(
        {
          household_id: invite.household_id,
          user_id: userData.user.id,
          role: 'member',
        },
        {
          ignoreDuplicates: true,
          onConflict: 'household_id,user_id',
        },
      );

    if (memberError) {
      return jsonResponse({ error: 'Could not join household' }, 500);
    }

    const { error: preferencesError } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          household_id: invite.household_id,
          user_id: userData.user.id,
        },
        {
          ignoreDuplicates: true,
          onConflict: 'household_id,user_id',
        },
      );

    if (preferencesError) {
      return jsonResponse({ error: 'Could not create notification preferences' }, 500);
    }

    const { error: updateError } = await supabase
      .from('household_invites')
      .update({
        used_at: new Date().toISOString(),
        used_by: userData.user.id,
      })
      .eq('id', invite.id)
      .is('used_at', null);

    if (updateError) {
      return jsonResponse({ error: 'Could not mark invite as used' }, 500);
    }

    const household = Array.isArray(invite.households)
      ? invite.households[0]
      : invite.households;

    return jsonResponse({
      household_id: invite.household_id,
      household_name: household?.name ?? 'your household',
    });
  } catch {
    return jsonResponse({ error: 'Unexpected invite acceptance error' }, 500);
  }
});
