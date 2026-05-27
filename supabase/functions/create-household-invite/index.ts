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

function generateInviteCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);

  return String(values[0] % 1_000_000).padStart(6, '0');
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
      invited_email?: unknown;
    };

    if (!body.household_id) {
      return jsonResponse({ error: 'household_id is required' }, 400);
    }

    const invitedEmail = normalizeEmail(body.invited_email);

    if (!invitedEmail || !isValidEmail(invitedEmail)) {
      return jsonResponse({ error: 'A valid invited_email is required' }, 400);
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

    const { data: existingPendingInvite, error: pendingInviteError } =
      await supabase
        .from('household_invites')
        .select('id')
        .eq('household_id', body.household_id)
        .eq('invited_email', invitedEmail)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (pendingInviteError) {
      return jsonResponse({ error: 'Could not check pending invites' }, 500);
    }

    if (existingPendingInvite) {
      return jsonResponse(
        { error: 'This email already has a pending invite' },
        409,
      );
    }

    const { data: invitedProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', invitedEmail)
      .maybeSingle();

    if (profileError) {
      return jsonResponse({ error: 'Could not check invited user' }, 500);
    }

    if (invitedProfile) {
      const { data: existingMemberships, error: existingMembershipsError } =
        await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', invitedProfile.id);

      if (existingMembershipsError) {
        return jsonResponse({ error: 'Could not check invited membership' }, 500);
      }

      const belongsToOtherHousehold = existingMemberships.some(
        (row) => row.household_id !== body.household_id,
      );

      if (belongsToOtherHousehold) {
        return jsonResponse(
          { error: 'This user already belongs to another household' },
          409,
        );
      }

      const { error: memberError } = await supabase
        .from('household_members')
        .upsert(
          {
            household_id: body.household_id,
            user_id: invitedProfile.id,
            role: 'member',
          },
          {
            ignoreDuplicates: true,
            onConflict: 'household_id,user_id',
          },
        );

      if (memberError) {
        return jsonResponse({ error: 'Could not add household member' }, 500);
      }

      const { error: preferencesError } = await supabase
        .from('notification_preferences')
        .upsert(
          {
            household_id: body.household_id,
            user_id: invitedProfile.id,
          },
          {
            ignoreDuplicates: true,
            onConflict: 'household_id,user_id',
          },
        );

      if (preferencesError) {
        return jsonResponse({ error: 'Could not create notification preferences' }, 500);
      }

      return jsonResponse({
        status: 'member_added',
        added_email: invitedProfile.email ?? invitedEmail,
      });
    }

    let rawToken = generateInviteCode();
    let tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let insertError: unknown = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { error } = await supabase
        .from('household_invites')
        .insert({
          household_id: body.household_id,
          invited_email: invitedEmail,
          invite_code: rawToken,
          token_hash: tokenHash,
          created_by: userData.user.id,
          expires_at: expiresAt.toISOString(),
        });

      if (!error) {
        insertError = null;
        break;
      }

      insertError = error;
      rawToken = generateInviteCode();
      tokenHash = await sha256Hex(rawToken);
    }

    if (insertError) {
      return jsonResponse({ error: 'Could not create invite' }, 500);
    }

    const appUrl =
      Deno.env.get('APP_URL') ??
      request.headers.get('Origin') ??
      new URL(request.url).origin;

    return jsonResponse({
      status: 'invite_created',
      invite_code: rawToken,
      invite_link: `${appUrl.replace(/\/$/, '')}/invite/${rawToken}`,
      expires_at: expiresAt.toISOString(),
    });
  } catch {
    return jsonResponse({ error: 'Unexpected invite creation error' }, 500);
  }
});
