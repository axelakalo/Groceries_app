import { supabase } from '../lib/supabaseClient';

export interface DiscordIntegrationStatus {
  id: string;
  household_id: string;
  channel_id: string | null;
  enabled: boolean;
  mention_enabled: boolean;
  mention_role_id: string | null;
  updated_at: string;
}

export interface SaveDiscordIntegrationResult {
  integration: DiscordIntegrationStatus;
}

export interface TestDiscordIntegrationResult {
  ok: boolean;
}

export interface DeleteDiscordIntegrationResult {
  ok: boolean;
}

async function getFunctionError(error: unknown, fallback: string) {
  const context =
    typeof error === 'object' && error !== null && 'context' in error
      ? (error.context as Response | undefined)
      : undefined;

  if (context) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };

      if (typeof body.error === 'string') {
        return new Error(body.error);
      }
    } catch {
      // Fall through to the generic message below.
    }
  }

  return error instanceof Error ? error : new Error(fallback);
}

export async function getDiscordIntegrationStatus(
  householdId: string,
): Promise<DiscordIntegrationStatus | null> {
  const { data, error } = await supabase
    .from('discord_integrations')
    .select(
      'id, household_id, channel_id, enabled, mention_enabled, mention_role_id, updated_at',
    )
    .eq('household_id', householdId)
    .maybeSingle();

  if (error) {
    throw await getFunctionError(error, 'Could not save Discord webhook.');
  }

  return data as DiscordIntegrationStatus | null;
}

export async function saveDiscordIntegration(
  householdId: string,
  webhookUrl: string,
  enabled: boolean,
  mentionEnabled: boolean,
  mentionRoleId: string | null,
): Promise<DiscordIntegrationStatus> {
  const { data, error } =
    await supabase.functions.invoke<SaveDiscordIntegrationResult>(
      'save-discord-integration',
      {
        body: {
          household_id: householdId,
          webhook_url: webhookUrl,
          enabled,
          mention_enabled: mentionEnabled,
          mention_role_id: mentionRoleId,
        },
      },
    );

  if (error) {
    throw await getFunctionError(error, 'Could not send Discord test message.');
  }

  if (!data?.integration) {
    throw new Error('Discord integration was not saved.');
  }

  return data.integration;
}

export async function testDiscordIntegration(
  householdId: string,
  webhookUrl?: string,
  mentionEnabled?: boolean,
  mentionRoleId?: string | null,
): Promise<void> {
  const { data, error } =
    await supabase.functions.invoke<TestDiscordIntegrationResult>(
      'test-discord-integration',
      {
        body: {
          household_id: householdId,
          webhook_url: webhookUrl?.trim() || undefined,
          mention_enabled: mentionEnabled,
          mention_role_id: mentionRoleId,
        },
      },
    );

  if (error) {
    throw await getFunctionError(error, 'Could not delete Discord webhook.');
  }

  if (!data?.ok) {
    throw new Error('Discord test message was not sent.');
  }
}

export async function deleteDiscordIntegration(householdId: string): Promise<void> {
  const { data, error } =
    await supabase.functions.invoke<DeleteDiscordIntegrationResult>(
      'delete-discord-integration',
      {
        body: {
          household_id: householdId,
        },
      },
    );

  if (error) {
    throw error;
  }

  if (!data?.ok) {
    throw new Error('Discord webhook was not deleted.');
  }
}
