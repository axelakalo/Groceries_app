# Reminder Sprint Progress

## Goal

Build one shared expiration reminder engine with multiple delivery channels:

- Discord reminders
- PWA push notifications
- Email later if needed

The reminder decision logic should stay shared. Delivery channels should plug into that logic without duplicating expiration checks.

## Completed

- Added reminder channel schema in `supabase/migrations/0014_discord_push_reminder_channels.sql`.
- Added `push_enabled` and `discord_enabled` to `notification_preferences`.
- Added `channel` and `error_message` to `expiration_reminder_logs`.
- Added `push_subscriptions`.
- Added `discord_integrations`.
- Added RLS and indexes for the new tables.
- Added Discord integration service in `src/services/discordIntegrationService.ts`.
- Added Discord reminder UI to Notification Preferences.
- Added `save-discord-integration` Edge Function.
- Added `test-discord-integration` Edge Function.
- Extended `send-expiration-reminders` to send grouped Discord summaries.
- Deployed Edge Functions:
  - `save-discord-integration`
  - `test-discord-integration`
  - `send-expiration-reminders`
- Added browser push helper in `src/lib/pushNotifications.ts`.
- Added push service worker listener in `public/push-sw.js`.
- Imported the push listener through the existing Vite PWA service worker.
- Added push controls to Notification Preferences.
- Added `test-push-notification` Edge Function.
- Deployed `test-push-notification`.
- Generated VAPID keys.
- Added `VITE_VAPID_PUBLIC_KEY` to local frontend env and `.env.example`.
- Set Supabase VAPID secrets for server-side push delivery.
- Redeployed `test-push-notification` after setting secrets.
- Applied migration `0014` to the linked Supabase database.
- Verified remote migration history through `0014`.
- Added Discord role mention support for Groceries_Alert.
- Added migration `0015_discord_role_mentions.sql`.
- Applied migration `0015` to the linked Supabase database.
- Updated and redeployed Discord save/test/reminder Edge Functions for role mentions.
- Added migration `0016_backfill_discord_groceries_alert_role.sql`.
- Applied migration `0016` to the linked Supabase database.
- Added push delivery to `send-expiration-reminders`.
- Redeployed `send-expiration-reminders` with push and Discord delivery.
- Verified:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## In Progress

- Manual live reminder test with an item expiring today or in 2/7/30 days.

## PWA Push Sprint Checklist

- [x] Add browser push helper in `src/lib/pushNotifications.ts`.
- [x] Add a push-capable service worker listener.
- [x] Add Settings or Notification Preferences UI:
  - Show browser support state.
  - Show iPhone Home Screen install warning.
  - Enable Push Notifications.
  - Disable Push Notifications.
  - Send Test Push.
- [x] Save push subscription rows to `push_subscriptions`.
- [x] Update `notification_preferences.push_enabled`.
- [x] Add `test-push-notification` Edge Function.
- [x] Deploy `test-push-notification`.
- [x] Verify:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## Later

- Add optional Discord bot slash-command sprint.
