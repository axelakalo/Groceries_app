import { supabase } from '../lib/supabaseClient';

export interface NotificationPreferences {
  id: string;
  household_id: string;
  user_id: string;
  notify_30_days_before: boolean;
  notify_7_days_before: boolean;
  notify_2_days_before: boolean;
  notify_on_expiration_day: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  discord_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type NotificationPreferencesPatch = Partial<
  Pick<
    NotificationPreferences,
    | 'notify_30_days_before'
    | 'notify_7_days_before'
    | 'notify_2_days_before'
    | 'notify_on_expiration_day'
    | 'email_enabled'
    | 'push_enabled'
    | 'discord_enabled'
  >
>;

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('You need to be signed in to edit notification preferences.');
  }

  return data.user.id;
}

export async function getMyPreferences(
  householdId: string,
): Promise<NotificationPreferences> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as NotificationPreferences;
  }

  const { data: created, error: insertError } = await supabase
    .from('notification_preferences')
    .insert({
      household_id: householdId,
      user_id: userId,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  if (!created) {
    throw new Error('Notification preferences were not created.');
  }

  return created as NotificationPreferences;
}

export async function updatePreferences(
  householdId: string,
  patch: NotificationPreferencesPatch,
): Promise<NotificationPreferences> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('notification_preferences')
    .update(patch)
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Notification preferences were not updated.');
  }

  return data as NotificationPreferences;
}
