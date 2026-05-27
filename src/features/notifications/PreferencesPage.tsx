import { useCallback, useEffect, useState } from 'react';
import BackButton from '../../components/common/BackButton';
import ErrorState from '../../components/common/ErrorState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import {
  disablePushNotifications,
  getNotificationPermission,
  getPushSupportMessage,
  isPushSupported,
  sendTestPushNotification,
  subscribeToPushNotifications,
} from '../../lib/pushNotifications';
import {
  deleteDiscordIntegration,
  getDiscordIntegrationStatus,
  saveDiscordIntegration,
  testDiscordIntegration,
  type DiscordIntegrationStatus,
} from '../../services/discordIntegrationService';
import {
  getMyPreferences,
  updatePreferences,
  type NotificationPreferences,
  type NotificationPreferencesPatch,
} from '../../services/notificationService';
import { useActiveHousehold } from '../household/useActiveHousehold';

type PreferenceKey = keyof NotificationPreferencesPatch;
type PushPermissionState = NotificationPermission | 'unsupported';
const DEFAULT_DISCORD_ROLE_ID = '1509203591334858804';
const PUSH_DEBUG_STORAGE_KEY = 'pantrysync.lastPushDebug';

function getErrorDebug(error: unknown) {
  if (error instanceof DOMException) {
    return {
      kind: 'DOMException',
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack ?? null,
    };
  }

  if (error instanceof Error) {
    return {
      kind: 'Error',
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    kind: typeof error,
    value: String(error),
  };
}

function getPushDebugPayload(error: unknown) {
  return {
    timestamp: new Date().toISOString(),
    error: getErrorDebug(error),
    context: {
      href: window.location.href,
      origin: window.location.origin,
      protocol: window.location.protocol,
      host: window.location.host,
      isSecureContext: window.isSecureContext,
      notificationPermission:
        'Notification' in window ? Notification.permission : 'unsupported',
      hasServiceWorker: 'serviceWorker' in navigator,
      hasPushManager: 'PushManager' in window,
      hasNotification: 'Notification' in window,
      userAgent: navigator.userAgent,
    },
  };
}

const preferenceRows: {
  key: PreferenceKey;
  title: string;
  description: string;
}[] = [
  {
    key: 'email_enabled',
    title: 'Email reminders',
    description: 'Send reminders to your account email when an item matches your timing rules.',
  },
  {
    key: 'notify_7_days_before',
    title: '7 days before',
    description: 'A week out, when there is still time to plan around it.',
  },
  {
    key: 'notify_2_days_before',
    title: '2 days before',
    description: 'A last useful heads-up before something goes bad.',
  },
  {
    key: 'notify_on_expiration_day',
    title: 'Expiration day',
    description: 'A same-day reminder for items that need attention now.',
  },
  {
    key: 'notify_30_days_before',
    title: '30 days before',
    description: 'Useful for bulk freezer or long-storage items.',
  },
];

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      aria-label={checked ? 'Turn off' : 'Turn on'}
      aria-pressed={checked}
      role="switch"
      className={`group relative grid h-9 w-[4.25rem] shrink-0 grid-cols-2 overflow-hidden rounded-full border p-1 shadow-inner transition-all duration-200 ${
        checked
          ? 'border-blue-400/40 bg-blue-500/90 shadow-blue-950/30'
          : 'border-zinc-700 bg-zinc-800 shadow-black/30'
      } disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={disabled}
      onClick={onChange}
      type="button"
    >
      <span
        className={`absolute left-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[0.65rem] font-black text-zinc-900 shadow-lg transition-transform duration-200 ${
          checked ? 'translate-x-8' : 'translate-x-0'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      <span
        className={`z-10 self-center text-center text-[0.65rem] font-bold transition-colors ${
          checked ? 'text-white' : 'text-zinc-500'
        }`}
      >
        ON
      </span>
      <span
        className={`z-10 self-center text-center text-[0.65rem] font-bold transition-colors ${
          checked ? 'text-blue-100/70' : 'text-zinc-300'
        }`}
      >
        OFF
      </span>
    </button>
  );
}

export default function PreferencesPage() {
  const { activeHousehold } = useActiveHousehold();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);
  const [error, setError] = useState('');
  const [discordStatus, setDiscordStatus] =
    useState<DiscordIntegrationStatus | null>(null);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [discordMentionEnabled, setDiscordMentionEnabled] = useState(true);
  const [discordMentionRoleId, setDiscordMentionRoleId] = useState(
    DEFAULT_DISCORD_ROLE_ID,
  );
  const [isEditingDiscord, setIsEditingDiscord] = useState(false);
  const [discordSaving, setDiscordSaving] = useState(false);
  const [discordDeleting, setDiscordDeleting] = useState(false);
  const [discordTesting, setDiscordTesting] = useState(false);
  const [discordMessage, setDiscordMessage] = useState('');
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(
    getNotificationPermission(),
  );
  const [pushBusy, setPushBusy] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [pushDebugInfo, setPushDebugInfo] = useState('');

  const householdId = activeHousehold?.id ?? null;
  const isHouseholdOwner = activeHousehold?.role === 'owner';
  const pushSupported = isPushSupported();
  const pushSupportMessage = getPushSupportMessage();
  const discordRoleIdIsValid = /^[0-9]{17,20}$/u.test(
    discordMentionRoleId.trim(),
  );

  const loadPreferences = useCallback(async () => {
    if (!householdId) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [nextPreferences, nextDiscordStatus] = await Promise.all([
        getMyPreferences(householdId),
        getDiscordIntegrationStatus(householdId),
      ]);
      setPreferences(nextPreferences);
      setDiscordStatus(nextDiscordStatus);
      setDiscordMentionEnabled(nextDiscordStatus?.mention_enabled ?? true);
      setDiscordMentionRoleId(
        nextDiscordStatus?.mention_role_id ?? DEFAULT_DISCORD_ROLE_ID,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load notification preferences.',
      );
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (!householdId) {
      return;
    }

    const activeHouseholdId = householdId;
    let cancelled = false;

    async function loadInitialPreferences() {
      try {
        const [result, nextDiscordStatus] = await Promise.all([
          getMyPreferences(activeHouseholdId),
          getDiscordIntegrationStatus(activeHouseholdId),
        ]);

        if (!cancelled) {
          setPreferences(result);
          setDiscordStatus(nextDiscordStatus);
          setDiscordMentionEnabled(nextDiscordStatus?.mention_enabled ?? true);
          setDiscordMentionRoleId(
            nextDiscordStatus?.mention_role_id ?? DEFAULT_DISCORD_ROLE_ID,
          );
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load notification preferences.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialPreferences();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  async function handleToggle(key: PreferenceKey) {
    if (!householdId || !preferences) {
      return;
    }

    const nextValue = !preferences[key];
    const previous = preferences;
    const nextPreferences = {
      ...preferences,
      [key]: nextValue,
    };

    setPreferences(nextPreferences);
    setSavingKey(key);
    setError('');

    try {
      const saved = await updatePreferences(householdId, {
        [key]: nextValue,
      });
      setPreferences(saved);
    } catch (err) {
      setPreferences(previous);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save notification preferences.',
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function handleDiscordToggle() {
    if (!householdId || !preferences) {
      return;
    }

    const nextValue = !preferences.discord_enabled;
    const previous = preferences;

    setPreferences({
      ...preferences,
      discord_enabled: nextValue,
    });
    setSavingKey('discord_enabled');
    setError('');
    setDiscordMessage('');

    try {
      const saved = await updatePreferences(householdId, {
        discord_enabled: nextValue,
      });
      setPreferences(saved);
      setDiscordMessage(
        nextValue ? 'Discord reminders enabled.' : 'Discord reminders disabled.',
      );
    } catch (err) {
      setPreferences(previous);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not update Discord reminders.',
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveDiscord() {
    if (!householdId || !preferences) {
      return;
    }

    setDiscordSaving(true);
    setDiscordMessage('');
    setError('');

    try {
      const saved = await saveDiscordIntegration(
        householdId,
        discordWebhookUrl,
        preferences.discord_enabled,
        discordMentionEnabled,
        discordMentionRoleId.trim() || null,
      );
      setDiscordStatus(saved);
      setDiscordWebhookUrl('');
      setIsEditingDiscord(false);
      setDiscordMessage('Discord webhook saved.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save Discord webhook.',
      );
    } finally {
      setDiscordSaving(false);
    }
  }

  async function handleTestDiscord() {
    if (!householdId) {
      return;
    }

    setDiscordTesting(true);
    setDiscordMessage('');
    setError('');

    try {
      await testDiscordIntegration(
        householdId,
        discordWebhookUrl,
        discordMentionEnabled,
        discordMentionRoleId.trim() || null,
      );
      setDiscordMessage('Test message sent to Discord.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not send Discord test message.',
      );
    } finally {
      setDiscordTesting(false);
    }
  }

  async function handleDeleteDiscord() {
    if (!householdId) {
      return;
    }

    setDiscordDeleting(true);
    setDiscordMessage('');
    setError('');

    try {
      await deleteDiscordIntegration(householdId);
      const saved = await getMyPreferences(householdId);
      setPreferences(saved);
      setDiscordStatus(null);
      setDiscordWebhookUrl('');
      setDiscordMentionEnabled(true);
      setDiscordMentionRoleId(DEFAULT_DISCORD_ROLE_ID);
      setIsEditingDiscord(false);
      setDiscordMessage('Discord webhook deleted.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not delete Discord webhook.',
      );
    } finally {
      setDiscordDeleting(false);
    }
  }

  async function handleEnablePush() {
    if (!householdId) {
      return;
    }

    setPushBusy(true);
    setPushMessage('');
    setPushDebugInfo('');
    setError('');

    try {
      await subscribeToPushNotifications(householdId);
      const saved = await getMyPreferences(householdId);
      setPreferences(saved);
      setPushPermission(getNotificationPermission());
      setPushMessage('Push notifications enabled.');
    } catch (err) {
      const debugPayload = getPushDebugPayload(err);
      const debugText = JSON.stringify(debugPayload, null, 2);

      console.error('PantrySync push enable failed', debugPayload);
      localStorage.setItem(PUSH_DEBUG_STORAGE_KEY, debugText);
      setPushDebugInfo(debugText);
      setPushPermission(getNotificationPermission());
      setError(
        err instanceof Error ? err.message : 'Could not enable push notifications.',
      );
    } finally {
      setPushBusy(false);
    }
  }

  async function handleCopyPushDebug() {
    if (!pushDebugInfo) {
      return;
    }

    await navigator.clipboard.writeText(pushDebugInfo);
    setPushMessage('Push debug info copied.');
  }

  async function handleDisablePush() {
    if (!householdId) {
      return;
    }

    setPushBusy(true);
    setPushMessage('');
    setError('');

    try {
      await disablePushNotifications(householdId);
      const saved = await getMyPreferences(householdId);
      setPreferences(saved);
      setPushPermission(getNotificationPermission());
      setPushMessage('Push notifications disabled on this device.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not disable push notifications.',
      );
    } finally {
      setPushBusy(false);
    }
  }

  async function handleTestPush() {
    if (!householdId) {
      return;
    }

    setPushTesting(true);
    setPushMessage('');
    setError('');

    try {
      await sendTestPushNotification(householdId);
      setPushMessage('Test push sent.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not send test push.',
      );
    } finally {
      setPushTesting(false);
    }
  }

  return (
    <div className="space-y-5 p-4">
      <div>
        <BackButton fallback="/app/settings" label="Settings" />
        <h1 className="mt-3 text-2xl font-bold text-zinc-100">
          Notification Preferences
        </h1>
        <p className="text-sm text-zinc-500">
          Choose when PantrySync should flag expiring items.
        </p>
      </div>

      {error ? <ErrorState error={error} onRetry={loadPreferences} /> : null}

      {loading || !preferences ? (
        <div className="space-y-3">
          <LoadingSkeleton className="h-24 w-full" />
          <LoadingSkeleton className="h-24 w-full" />
          <LoadingSkeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-2">
          <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/85 shadow-lg shadow-black/10">
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-blue-400 to-emerald-300" />
            <div className="space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-200">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M7 8h10M7 12h6M5 20l3-3h9a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.9"
                    />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black text-zinc-100">
                      Discord reminders
                    </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                      discordStatus?.enabled
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {discordStatus?.enabled ? 'CONNECTED' : 'NOT CONNECTED'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Send expiration reminders into a private Discord channel.
                </p>
              </div>
              </div>
              <Toggle
                checked={preferences.discord_enabled}
                disabled={savingKey === 'discord_enabled'}
                onChange={() => void handleDiscordToggle()}
              />
            </div>

            {discordStatus ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Connected channel
                    </p>
                    <p className="font-semibold text-zinc-100">
                      Discord webhook
                    </p>
                    <p className="truncate text-sm text-zinc-500">
                      Channel {discordStatus.channel_id ?? 'unknown'} · Updated{' '}
                      {new Date(discordStatus.updated_at).toLocaleDateString()}
                    </p>
                    <p className="truncate text-sm text-zinc-500">
                      Role mention{' '}
                      {discordStatus.mention_enabled && discordStatus.mention_role_id
                        ? `<@&${discordStatus.mention_role_id}>`
                        : 'off'}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                      discordStatus.enabled
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {discordStatus.enabled ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      discordTesting ||
                      (discordMentionEnabled && !discordRoleIdIsValid)
                    }
                    onClick={() => void handleTestDiscord()}
                    type="button"
                  >
                    {discordTesting ? 'Sending...' : 'Test'}
                  </button>
                  <button
                    className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
                    onClick={() => {
                      setIsEditingDiscord((current) => !current);
                      setDiscordWebhookUrl('');
                      setDiscordMentionEnabled(
                        discordStatus?.mention_enabled ?? true,
                      );
                      setDiscordMentionRoleId(
                        discordStatus?.mention_role_id ?? DEFAULT_DISCORD_ROLE_ID,
                      );
                      setDiscordMessage('');
                    }}
                    type="button"
                  >
                    {isEditingDiscord ? 'Cancel edit' : 'Edit'}
                  </button>
                  <button
                    className="h-10 rounded-xl border border-red-500/30 bg-red-500/5 px-4 text-sm font-semibold text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={discordDeleting || !isHouseholdOwner}
                    onClick={() => void handleDeleteDiscord()}
                    title={
                      isHouseholdOwner
                        ? 'Delete Discord webhook'
                        : 'Only household owners can delete the webhook'
                    }
                    type="button"
                  >
                    {discordDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : null}

            {!discordStatus || isEditingDiscord ? (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-zinc-200">
                    {discordStatus ? 'New webhook URL' : 'Webhook URL'}
                  </span>
                  <input
                    className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950/80 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                    onChange={(event) => setDiscordWebhookUrl(event.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    type="password"
                    value={discordWebhookUrl}
                  />
                </label>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-zinc-100">
                        Mention Groceries_Alert
                      </p>
                      <p className="text-sm text-zinc-500">
                        Notify the Discord role when test and expiration messages send.
                      </p>
                    </div>
                    <Toggle
                      checked={discordMentionEnabled}
                      disabled={discordSaving || discordTesting}
                      onChange={() =>
                        setDiscordMentionEnabled((current) => !current)
                      }
                    />
                  </div>
                  <label className="mt-3 block space-y-2">
                    <span className="text-sm font-medium text-zinc-200">
                      Role ID
                    </span>
                    <input
                      className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      disabled={!discordMentionEnabled}
                      inputMode="numeric"
                      maxLength={20}
                      onChange={(event) =>
                        setDiscordMentionRoleId(event.target.value)
                      }
                      placeholder={DEFAULT_DISCORD_ROLE_ID}
                      value={discordMentionRoleId}
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    className="h-11 rounded-xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
                    disabled={
                      discordSaving ||
                      !discordWebhookUrl.trim() ||
                      (discordMentionEnabled && !discordRoleIdIsValid)
                    }
                    onClick={() => void handleSaveDiscord()}
                    type="button"
                  >
                    {discordSaving
                      ? 'Saving...'
                      : discordStatus
                        ? 'Replace webhook'
                        : 'Save webhook'}
                  </button>
                  <button
                    className="h-11 rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 font-semibold text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      discordTesting ||
                      !discordWebhookUrl.trim() ||
                      (discordMentionEnabled && !discordRoleIdIsValid)
                    }
                    onClick={() => void handleTestDiscord()}
                    type="button"
                  >
                    {discordTesting ? 'Sending...' : 'Test before saving'}
                  </button>
                </div>
              </>
            ) : null}

            {discordMessage ? (
              <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {discordMessage}
              </p>
            ) : null}

            <p className="text-xs text-zinc-600">
              The saved webhook URL is kept server-side and is not shown here after saving.
            </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/85 shadow-lg shadow-black/10">
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-300" />
            <div className="space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-200">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.9"
                    />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black text-zinc-100">
                      Push notifications
                    </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                      preferences.push_enabled
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {preferences.push_enabled ? 'ENABLED' : 'OFF'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Send reminders to this device even when PantrySync is closed.
                </p>
              </div>
              </div>
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-semibold capitalize text-zinc-400">
                {pushPermission}
              </span>
            </div>

            {!pushSupported ? (
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {pushSupportMessage ?? 'Push notifications are not supported in this browser.'}
              </p>
            ) : null}

            <p className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-sm text-zinc-400">
              On iPhone, install PantrySync to your Home Screen first, then open
              it from the Home Screen and enable notifications.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              {preferences.push_enabled ? (
                <button
                  className="h-11 rounded-xl border border-zinc-700 px-4 font-semibold text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={pushBusy}
                  onClick={() => void handleDisablePush()}
                  type="button"
                >
                  {pushBusy ? 'Disabling...' : 'Disable push'}
                </button>
              ) : (
                <button
                  className="h-11 rounded-xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
                  disabled={pushBusy || !pushSupported}
                  onClick={() => void handleEnablePush()}
                  type="button"
                >
                  {pushBusy ? 'Enabling...' : 'Enable push'}
                </button>
              )}
              <button
                className="h-11 rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 font-semibold text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pushTesting || !preferences.push_enabled}
                onClick={() => void handleTestPush()}
                type="button"
              >
                {pushTesting ? 'Sending...' : 'Send test push'}
              </button>
            </div>

            {pushMessage ? (
              <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {pushMessage}
              </p>
            ) : null}
            {pushDebugInfo ? (
              <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-zinc-200">
                    Push debug info logged
                  </p>
                  <button
                    className="h-9 rounded-xl border border-zinc-700 px-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
                    onClick={() => void handleCopyPushDebug()}
                    type="button"
                  >
                    Copy debug info
                  </button>
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-zinc-400">
                  {pushDebugInfo}
                </pre>
              </div>
            ) : null}
            </div>
          </section>
          </div>

          {preferenceRows.map((row) => {
            const disabled = savingKey === row.key;
            const isChecked = Boolean(preferences[row.key]);

            return (
              <div
                className={`flex items-center justify-between gap-4 rounded-2xl border p-4 shadow-lg shadow-black/10 transition-colors ${
                  isChecked
                    ? 'border-blue-500/25 bg-blue-500/[0.07]'
                    : 'border-zinc-800 bg-zinc-900'
                } ${disabled ? 'opacity-60' : ''}`}
                key={row.key}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-zinc-100">{row.title}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                        isChecked
                          ? 'bg-blue-500/15 text-blue-200'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {isChecked ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{row.description}</p>
                </div>
                <Toggle
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => void handleToggle(row.key)}
                />
              </div>
            );
          })}
        </div>
      )}

      <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
        Reminders are checked daily so expiring items can be surfaced at the
        right time.
      </p>
    </div>
  );
}
