import { supabase } from '../lib/supabaseClient';

export type ActivityEventType =
  | 'grocery_item_added'
  | 'grocery_item_checked'
  | 'grocery_item_unchecked'
  | 'grocery_item_deleted'
  | 'pantry_item_added'
  | 'pantry_item_used'
  | 'pantry_item_discarded'
  | 'pantry_item_restored'
  | 'pantry_item_added_to_grocery'
  | 'household_member_joined'
  | 'household_member_left';

export type ActivityEntityType = 'grocery_item' | 'pantry_item' | 'household_member';

export interface ActivityEvent {
  id: string;
  household_id: string;
  actor_id: string;
  actor_display_name: string | null;
  event_type: ActivityEventType;
  entity_type: ActivityEntityType;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function logEvent(
  householdId: string,
  eventType: ActivityEventType,
  entityType: ActivityEntityType,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    const actorId = await getCurrentUserId();

    if (!actorId) {
      return;
    }

    await supabase.from('activity_events').insert({
      household_id: householdId,
      actor_id: actorId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  } catch {
    // Activity should never block the primary user action.
  }
}

export async function getRecentActivity(
  householdId: string,
  limit = 10,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<Omit<ActivityEvent, 'actor_display_name'>[]>();

  if (error) {
    throw error;
  }

  const actorIds = [...new Set(data.map((event) => event.actor_id))];
  const displayNames = new Map<string, string | null>();

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', actorIds)
      .returns<{ id: string; display_name: string | null }[]>();

    profiles?.forEach((profile) => {
      displayNames.set(profile.id, profile.display_name);
    });
  }

  return data.map((event) => ({
    ...event,
    metadata: event.metadata ?? {},
    actor_display_name: displayNames.get(event.actor_id) ?? null,
  }));
}

export async function deleteActivityEvent(id: string): Promise<void> {
  const { error } = await supabase.from('activity_events').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export async function clearActivityForHousehold(householdId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_events')
    .delete()
    .eq('household_id', householdId);

  if (error) {
    throw error;
  }
}
