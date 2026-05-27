import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ReminderType = '30_day' | '7_day' | '2_day' | 'day_of';

interface PantryItem {
  id: string;
  household_id: string;
  custom_name: string | null;
  expiration_date: string;
}

interface HouseholdMember {
  household_id: string;
  user_id: string;
}

interface NotificationPreference {
  household_id: string;
  user_id: string;
  notify_30_days_before: boolean;
  notify_7_days_before: boolean;
  notify_2_days_before: boolean;
  notify_on_expiration_day: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  discord_enabled: boolean;
}

interface PushSubscriptionRow {
  household_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface DiscordIntegration {
  household_id: string;
  webhook_url: string;
  enabled: boolean;
  mention_enabled: boolean;
  mention_role_id: string | null;
}

interface ExistingLog {
  pantry_item_id: string;
  user_id: string;
  reminder_type: ReminderType;
  reminder_date: string;
  channel: 'email' | 'push' | 'discord';
}

interface ReminderLogRow {
  household_id: string;
  pantry_item_id: string;
  user_id: string;
  reminder_type: ReminderType;
  reminder_date: string;
  channel: 'email' | 'push' | 'discord';
  delivery_status: 'sent' | 'failed' | 'skipped' | 'logged';
  error_message?: string;
}

interface DiscordReminderItem {
  id: string;
  household_id: string;
  name: string;
  reminder_type: ReminderType;
  expiration_date: string;
}

interface PushDelivery {
  item: PantryItem;
  reminder_type: ReminderType;
  row: ReminderLogRow;
  subscriptions: PushSubscriptionRow[];
}

const preferenceByReminder: Record<
  ReminderType,
  keyof Pick<
    NotificationPreference,
    | 'notify_30_days_before'
    | 'notify_7_days_before'
    | 'notify_2_days_before'
    | 'notify_on_expiration_day'
  >
> = {
  '30_day': 'notify_30_days_before',
  '7_day': 'notify_7_days_before',
  '2_day': 'notify_2_days_before',
  day_of: 'notify_on_expiration_day',
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

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);

  return formatDate(nextDate);
}

function makeLogKey(log: ExistingLog) {
  return `${log.pantry_item_id}:${log.user_id}:${log.reminder_type}:${log.channel}:${log.reminder_date}`;
}

function getItemName(item: PantryItem) {
  return item.custom_name ?? 'Pantry item';
}

function getDiscordFieldName(reminderType: ReminderType) {
  if (reminderType === 'day_of') {
    return 'Today';
  }

  if (reminderType === '2_day') {
    return 'In 2 days';
  }

  if (reminderType === '7_day') {
    return 'In 7 days';
  }

  return 'In 30 days';
}

function getPushTitle(item: PantryItem, reminderType: ReminderType) {
  const itemName = getItemName(item);

  if (reminderType === 'day_of') {
    return `${itemName} expires today`;
  }

  if (reminderType === '2_day') {
    return `${itemName} expires in 2 days`;
  }

  if (reminderType === '7_day') {
    return `${itemName} expires in 7 days`;
  }

  return `${itemName} expires in 30 days`;
}

function getPushPayload(item: PantryItem, reminderType: ReminderType) {
  return JSON.stringify({
    title: getPushTitle(item, reminderType),
    body: 'Open PantrySync to mark it used, discarded, or add it to groceries.',
    url: '/app/pantry',
    pantryItemId: item.id,
  });
}

async function sendPushReminder(delivery: PushDelivery) {
  const payload = getPushPayload(delivery.item, delivery.reminder_type);
  const results = await Promise.allSettled(
    delivery.subscriptions.map((subscription) =>
      webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload,
      ),
    ),
  );
  const sentCount = results.filter((result) => result.status === 'fulfilled').length;

  if (sentCount > 0) {
    return {
      ...delivery.row,
      delivery_status: 'sent' as const,
    };
  }

  const firstFailure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  return {
    ...delivery.row,
    delivery_status: 'failed' as const,
    error_message:
      firstFailure?.reason instanceof Error
        ? firstFailure.reason.message
        : 'Push delivery failed',
  };
}

function isValidRoleId(value: string) {
  return /^[0-9]{17,20}$/u.test(value);
}

function getDiscordMentionPayload(integration: DiscordIntegration) {
  if (
    integration.mention_enabled &&
    integration.mention_role_id &&
    isValidRoleId(integration.mention_role_id)
  ) {
    return {
      content: `<@&${integration.mention_role_id}> ⚠️ PantrySync Reminder`,
      allowed_mentions: {
        roles: [integration.mention_role_id],
      },
    };
  }

  return {
    allowed_mentions: {
      parse: [],
    },
  };
}

async function sendDiscordReminder(
  integration: DiscordIntegration,
  items: DiscordReminderItem[],
) {
  const groups = new Map<ReminderType, DiscordReminderItem[]>();

  for (const item of items) {
    const group = groups.get(item.reminder_type) ?? [];
    group.push(item);
    groups.set(item.reminder_type, group);
  }

  const fields = Array.from(groups.entries()).map(([reminderType, group]) => ({
    name: getDiscordFieldName(reminderType),
    value: group
      .map((item) => `• ${item.name} (${item.expiration_date})`)
      .join('\n')
      .slice(0, 1024),
  }));

  const mentionPayload = getDiscordMentionPayload(integration);

  const response = await fetch(integration.webhook_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...mentionPayload,
      embeds: [
        {
          title: 'Items expiring soon',
          description: 'Open PantrySync to update your pantry.',
          fields,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed with ${response.status}`);
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
    const today = formatDate(new Date());
    const targetDates: Record<ReminderType, string> = {
      day_of: today,
      '2_day': addDays(new Date(), 2),
      '7_day': addDays(new Date(), 7),
      '30_day': addDays(new Date(), 30),
    };
    const reminderByDate = new Map(
      Object.entries(targetDates).map(([type, date]) => [
        date,
        type as ReminderType,
      ]),
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

    const { data: pantryItems, error: pantryError } = await supabase
      .from('pantry_items')
      .select('id, household_id, custom_name, expiration_date')
      .eq('status', 'active')
      .eq('has_expiration', true)
      .in('expiration_date', Object.values(targetDates))
      .returns<PantryItem[]>();

    if (pantryError) {
      return jsonResponse({ processed: 0, logged: 0, skipped: 0, failed: 1 }, 500);
    }

    if (!pantryItems.length) {
      return jsonResponse({ processed: 0, logged: 0, skipped: 0, failed: 0 });
    }

    const householdIds = [...new Set(pantryItems.map((item) => item.household_id))];
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select('household_id, user_id')
      .in('household_id', householdIds)
      .returns<HouseholdMember[]>();

    if (membersError) {
      return jsonResponse({ processed: 0, logged: 0, skipped: 0, failed: 1 }, 500);
    }

    const userIds = [...new Set(members.map((member) => member.user_id))];
    const { data: preferences, error: preferencesError } = await supabase
      .from('notification_preferences')
      .select(
        'household_id, user_id, notify_30_days_before, notify_7_days_before, notify_2_days_before, notify_on_expiration_day, email_enabled, push_enabled, discord_enabled',
      )
      .in('household_id', householdIds)
      .in('user_id', userIds)
      .returns<NotificationPreference[]>();

    if (preferencesError) {
      return jsonResponse({ processed: 0, logged: 0, skipped: 0, failed: 1 }, 500);
    }

    const { data: pushSubscriptions, error: pushSubscriptionsError } =
      await supabase
        .from('push_subscriptions')
        .select('household_id, user_id, endpoint, p256dh, auth')
        .in('household_id', householdIds)
        .in('user_id', userIds)
        .eq('enabled', true)
        .returns<PushSubscriptionRow[]>();

    if (pushSubscriptionsError) {
      return jsonResponse({ processed: 0, logged: 0, skipped: 0, failed: 1 }, 500);
    }

    const { data: discordIntegrations, error: discordIntegrationsError } =
      await supabase
        .from('discord_integrations')
        .select(
          'household_id, webhook_url, enabled, mention_enabled, mention_role_id',
        )
        .in('household_id', householdIds)
        .eq('enabled', true)
        .returns<DiscordIntegration[]>();

    if (discordIntegrationsError) {
      return jsonResponse({ processed: 0, logged: 0, skipped: 0, failed: 1 }, 500);
    }

    const { data: existingLogs, error: logsError } = await supabase
      .from('expiration_reminder_logs')
      .select('pantry_item_id, user_id, reminder_type, reminder_date, channel')
      .eq('reminder_date', today)
      .in('pantry_item_id', pantryItems.map((item) => item.id))
      .returns<ExistingLog[]>();

    if (logsError) {
      return jsonResponse({ processed: 0, logged: 0, skipped: 0, failed: 1 }, 500);
    }

    const membersByHousehold = new Map<string, HouseholdMember[]>();
    for (const member of members) {
      const householdMembers = membersByHousehold.get(member.household_id) ?? [];
      householdMembers.push(member);
      membersByHousehold.set(member.household_id, householdMembers);
    }

    const preferencesByMember = new Map<string, NotificationPreference>();
    for (const preference of preferences) {
      preferencesByMember.set(
        `${preference.household_id}:${preference.user_id}`,
        preference,
      );
    }

    const existingLogKeys = new Set((existingLogs ?? []).map(makeLogKey));
    const rowsToInsert: ReminderLogRow[] = [];
    const pushDeliveries: PushDelivery[] = [];
    const discordRowsByHousehold = new Map<string, ReminderLogRow[]>();
    const discordItemsByHousehold = new Map<string, Map<string, DiscordReminderItem>>();
    const discordIntegrationByHousehold = new Map(
      (discordIntegrations ?? []).map((integration) => [
        integration.household_id,
        integration,
      ]),
    );
    const pushSubscriptionsByMember = new Map<string, PushSubscriptionRow[]>();

    for (const subscription of pushSubscriptions ?? []) {
      const key = `${subscription.household_id}:${subscription.user_id}`;
      const userSubscriptions = pushSubscriptionsByMember.get(key) ?? [];
      userSubscriptions.push(subscription);
      pushSubscriptionsByMember.set(key, userSubscriptions);
    }
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of pantryItems) {
      const reminderType = reminderByDate.get(item.expiration_date);

      if (!reminderType) {
        skipped += 1;
        continue;
      }

      const householdMembers = membersByHousehold.get(item.household_id) ?? [];

      for (const member of householdMembers) {
        processed += 1;
        const preference = preferencesByMember.get(
          `${item.household_id}:${member.user_id}`,
        );

        if (!preference) {
          skipped += 1;
          continue;
        }

        if (!preference[preferenceByReminder[reminderType]]) {
          skipped += 1;
          continue;
        }

        if (preference.email_enabled) {
          const emailLogKey = `${item.id}:${member.user_id}:${reminderType}:email:${today}`;

          if (existingLogKeys.has(emailLogKey)) {
            skipped += 1;
          } else {
            rowsToInsert.push({
              household_id: item.household_id,
              pantry_item_id: item.id,
              user_id: member.user_id,
              reminder_type: reminderType,
              reminder_date: today,
              channel: 'email',
              delivery_status: 'logged',
            });
            existingLogKeys.add(emailLogKey);
          }
        }

        if (preference.push_enabled) {
          const memberSubscriptions = pushSubscriptionsByMember.get(
            `${item.household_id}:${member.user_id}`,
          ) ?? [];

          if (memberSubscriptions.length === 0) {
            skipped += 1;
          } else {
            const pushLogKey = `${item.id}:${member.user_id}:${reminderType}:push:${today}`;

            if (existingLogKeys.has(pushLogKey)) {
              skipped += 1;
            } else {
              pushDeliveries.push({
                item,
                reminder_type: reminderType,
                subscriptions: memberSubscriptions,
                row: {
                  household_id: item.household_id,
                  pantry_item_id: item.id,
                  user_id: member.user_id,
                  reminder_type: reminderType,
                  reminder_date: today,
                  channel: 'push',
                  delivery_status: 'sent',
                },
              });
              existingLogKeys.add(pushLogKey);
            }
          }
        }

        if (preference.discord_enabled) {
          const discordIntegration = discordIntegrationByHousehold.get(
            item.household_id,
          );

          if (!discordIntegration) {
            skipped += 1;
            continue;
          }

          const discordLogKey = `${item.id}:${member.user_id}:${reminderType}:discord:${today}`;

          if (existingLogKeys.has(discordLogKey)) {
            skipped += 1;
            continue;
          }

          const logRow: ReminderLogRow = {
            household_id: item.household_id,
            pantry_item_id: item.id,
            user_id: member.user_id,
            reminder_type: reminderType,
            reminder_date: today,
            channel: 'discord',
            delivery_status: 'pending',
          };
          const householdRows = discordRowsByHousehold.get(item.household_id) ?? [];
          householdRows.push(logRow);
          discordRowsByHousehold.set(item.household_id, householdRows);

          const householdItems =
            discordItemsByHousehold.get(item.household_id) ?? new Map();
          householdItems.set(`${item.id}:${reminderType}`, {
            id: item.id,
            household_id: item.household_id,
            name: getItemName(item),
            reminder_type: reminderType,
            expiration_date: item.expiration_date,
          });
          discordItemsByHousehold.set(item.household_id, householdItems);
          existingLogKeys.add(discordLogKey);
        }
      }
    }

    if (pushDeliveries.length > 0) {
      try {
        webpush.setVapidDetails(
          getEnv('VAPID_SUBJECT'),
          getEnv('VAPID_PUBLIC_KEY'),
          getEnv('VAPID_PRIVATE_KEY'),
        );

        const pushRows = await Promise.all(
          pushDeliveries.map((delivery) => sendPushReminder(delivery)),
        );
        failed += pushRows.filter((row) => row.delivery_status === 'failed').length;
        rowsToInsert.push(...pushRows);
      } catch (err) {
        failed += pushDeliveries.length;
        rowsToInsert.push(
          ...pushDeliveries.map((delivery) => ({
            ...delivery.row,
            delivery_status: 'failed' as const,
            error_message:
              err instanceof Error ? err.message : 'Push delivery failed',
          })),
        );
      }
    }

    for (const [householdId, discordRows] of discordRowsByHousehold.entries()) {
      const integration = discordIntegrationByHousehold.get(householdId);
      const householdItems = Array.from(
        discordItemsByHousehold.get(householdId)?.values() ?? [],
      );

      if (!integration || householdItems.length === 0) {
        skipped += discordRows.length;
        continue;
      }

      try {
        await sendDiscordReminder(integration, householdItems);
        rowsToInsert.push(
          ...discordRows.map((row) => ({
            ...row,
            delivery_status: 'sent' as const,
          })),
        );
      } catch (err) {
        failed += discordRows.length;
        rowsToInsert.push(
          ...discordRows.map((row) => ({
            ...row,
            delivery_status: 'failed' as const,
            error_message:
              err instanceof Error ? err.message : 'Discord delivery failed',
          })),
        );
      }
    }

    if (rowsToInsert.length === 0) {
      return jsonResponse({
        processed,
        logged: 0,
        skipped,
        failed,
      });
    }

    const { error: insertError } = await supabase
      .from('expiration_reminder_logs')
      .insert(rowsToInsert);

    if (insertError) {
      return jsonResponse(
        {
          processed,
          logged: 0,
          skipped,
          failed: failed + rowsToInsert.length,
        },
        500,
      );
    }

    return jsonResponse({
      processed,
      logged: rowsToInsert.length,
      skipped,
      failed,
    });
  } catch {
    return jsonResponse({ processed: 0, logged: 0, skipped: 0, failed: 1 }, 500);
  }
});
