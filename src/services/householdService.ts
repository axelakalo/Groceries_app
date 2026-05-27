import { supabase } from '../lib/supabaseClient';
import type { MemberRole } from '../lib/constants';

// --- Types ---

export interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  role: MemberRole;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  /** Joined from public.profiles — may be null if profile not yet created */
  display_name: string | null;
  email: string | null;
}

// --- Queries ---

/**
 * Returns all households the current user is a member of.
 * In the MVP each user should be in at most one household.
 */
export async function getMyHouseholds(): Promise<Household[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('Not authenticated.');
  }

  const { data, error } = await supabase
    .from('household_members')
    .select('role, households!inner(id, name, created_by, created_at, updated_at)')
    .eq('user_id', user.id)
    .returns<
      {
        role: string;
        households: Omit<Household, 'role'>;
      }[]
    >();

  if (error) {
    throw error;
  }

  const householdsById = new Map<string, Household>();

  for (const row of data) {
    const role = row.role as MemberRole;
    const existing = householdsById.get(row.households.id);

    if (!existing || role === 'owner') {
      householdsById.set(row.households.id, {
        ...row.households,
        role,
      });
    }
  }

  return [...householdsById.values()];
}

/**
 * Returns the first household the current user belongs to, or null if none.
 * MVP: users are in at most one household.
 */
export async function getActiveHousehold(): Promise<Household | null> {
  const households = await getMyHouseholds();
  return households[0] ?? null;
}

/**
 * Renames a household. Only owners may update (enforced by RLS).
 */
export async function updateHouseholdName(
  householdId: string,
  newName: string,
): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error('Household name cannot be empty.');
  }

  const { error } = await supabase
    .from('households')
    .update({ name: trimmed })
    .eq('id', householdId);

  if (error) {
    throw error;
  }
}

/**
 * Deletes a household entirely. Only the owner may do this (enforced by RLS).
 * CASCADE on household_members will remove all memberships automatically.
 */
export async function deleteHousehold(householdId: string): Promise<void> {
  const { error } = await supabase
    .from('households')
    .delete()
    .eq('id', householdId);

  if (error) {
    throw error;
  }
}

/**
 * Removes the current user's membership from a household.
 * RLS policy "users remove themselves" allows this.
 */
export async function leaveHousehold(householdId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated.');
  }

  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', user.id);

  if (error) {
    throw error;
  }
}

export async function removeMember(
  householdId: string,
  memberUserId: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated.');
  }

  if (user.id === memberUserId) {
    throw new Error('Owners must transfer ownership or delete the household instead.');
  }

  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', memberUserId);

  if (error) {
    throw error;
  }
}

/**
 * Atomically creates a household with the caller as owner, a default grocery
 * list, and default notification preferences via the Supabase RPC.
 *
 * Returns the newly created household.
 */
export async function createHousehold(name: string): Promise<Household> {
  const { data: householdId, error: rpcError } = await supabase.rpc(
    'create_household_with_defaults',
    { household_name: name },
  );

  if (rpcError) {
    throw rpcError;
  }

  const { data, error } = await supabase
    .from('households')
    .select('*')
    .eq('id', householdId as string)
    .single();

  if (error) {
    throw error;
  }

  return {
    ...(data as Omit<Household, 'role'>),
    role: 'owner',
  };
}

/**
 * Returns the members of a household with joined profile data.
 */
export async function getHouseholdMembers(
  householdId: string,
): Promise<HouseholdMember[]> {
  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select('id, household_id, user_id, role, created_at')
    .eq('household_id', householdId)
    .returns<
      {
        id: string;
        household_id: string;
        user_id: string;
        role: string;
        created_at: string;
      }[]
    >();

  if (membersError) {
    throw membersError;
  }

  const userIds = members.map((member) => member.user_id);

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, email')
    .in('id', userIds)
    .returns<
      { id: string; display_name: string | null; email: string | null }[]
    >();

  if (profilesError) {
    throw profilesError;
  }

  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );

  return members.map((row) => ({
    id: row.id,
    household_id: row.household_id,
    user_id: row.user_id,
    role: row.role as MemberRole,
    created_at: row.created_at,
    display_name: profilesById.get(row.user_id)?.display_name ?? null,
    email: profilesById.get(row.user_id)?.email ?? null,
  }));
}

export interface CreateHouseholdInviteInput {
  householdId: string;
  invitedEmail: string;
}

export interface CreateHouseholdInviteResult {
  status: 'member_added' | 'invite_created';
  added_email?: string;
  invite_code?: string;
  invite_link?: string;
  expires_at?: string;
}

export interface PendingHouseholdInvite {
  id: string;
  invited_email: string | null;
  invite_code: string | null;
  expires_at: string;
  created_at: string;
}

export interface AcceptHouseholdInviteResult {
  household_id: string;
  household_name: string;
}

export async function createHouseholdInvite({
  householdId,
  invitedEmail,
}: CreateHouseholdInviteInput): Promise<CreateHouseholdInviteResult> {
  const { data, error } =
    await supabase.functions.invoke<CreateHouseholdInviteResult>(
      'create-household-invite',
      {
        body: {
          household_id: householdId,
          invited_email: invitedEmail,
        },
      },
    );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Invite creation returned no data.');
  }

  const inviteCodeFromLink = data.invite_link?.match(/\/invite\/(\d{6})$/)?.[1];

  return {
    ...data,
    invite_code: data.invite_code ?? inviteCodeFromLink,
  };
}

export async function acceptHouseholdInvite(
  rawToken: string,
): Promise<AcceptHouseholdInviteResult> {
  const { data, error } =
    await supabase.functions.invoke<AcceptHouseholdInviteResult>(
      'accept-household-invite',
      {
        body: {
          raw_token: rawToken,
        },
      },
    );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Invite acceptance returned no data.');
  }

  return data;
}

export async function getPendingHouseholdInvites(
  householdId: string,
): Promise<PendingHouseholdInvite[]> {
  const { data, error } = await supabase
    .from('household_invites')
    .select('id, invited_email, invite_code, expires_at, created_at')
    .eq('household_id', householdId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .returns<PendingHouseholdInvite[]>();

  if (error) {
    throw error;
  }

  return data;
}

export async function deletePendingHouseholdInvite(inviteId: string) {
  const { data, error } = await supabase
    .from('household_invites')
    .delete()
    .eq('id', inviteId)
    .is('used_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Pending invite was not deleted. Apply the invite delete policy migration and try again.',
    );
  }
}
