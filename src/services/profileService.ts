import { supabase } from '../lib/supabaseClient';

export interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  phone_number: string | null;
}

export interface UserProfilePatch {
  display_name: string | null;
  phone_number: string | null;
}

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('You need to be signed in to edit your profile.');
  }

  return data.user;
}

export async function getMyProfile(): Promise<UserProfile> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, phone_number')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as UserProfile;
  }

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? null,
      display_name: null,
      phone_number: null,
    })
    .select('id, display_name, email, phone_number')
    .single();

  if (insertError) {
    throw insertError;
  }

  return created as UserProfile;
}

export async function updateMyProfile(
  patch: UserProfilePatch,
): Promise<UserProfile> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('id, display_name, email, phone_number')
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Profile was not updated.');
  }

  return data as UserProfile;
}
