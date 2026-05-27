# PantrySync

A PWA for a household (2 people) to share a grocery list and track pantry expiration dates. Mobile-first, dark theme, blue accent.

Personal grocery and pantry app for shared household use.

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- A [Supabase](https://supabase.com) project (free tier works)

### Setup

1. **Clone and install:**

   ```bash
   git clone <repo-url> pantry-sync
   cd pantry-sync
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

   Fill in your Supabase project URL and anon key:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

   Find these in your Supabase dashboard → Settings → API.

3. **Run the dev server:**

   ```bash
   npm run dev
   ```

4. **Open** [http://localhost:5173](http://localhost:5173)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React + TypeScript |
| Styling | Tailwind CSS v4 |
| Routing | React Router |
| Backend | Supabase (Auth, Postgres, RLS, Edge Functions, Realtime) |
| Barcode | Open Food Facts API (server-side only) |
| Scanner | html5-qrcode |
| Dates | date-fns |
| PWA | vite-plugin-pwa |
| Hosting | Vercel |

## Project Structure

```
src/
├── app/          # App shell, router, providers
├── components/   # Reusable UI components (by feature area)
├── features/     # Feature pages and hooks
├── lib/          # Utilities (supabase client, dates, barcode, etc.)
├── services/     # Data access layer (Supabase queries)
├── styles/       # Global CSS
└── types/        # TypeScript type definitions

supabase/
├── migrations/   # SQL migration files
├── functions/    # Edge Functions (Deno)
└── seed.sql      # Dev seed data
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |

## App Icons

Replace the placeholder icons in `public/icons/` with your own:
- `icon-192.svg` (192×192 placeholder)
- `icon-512.svg` (512×512 placeholder)
- `maskable-512.svg` (512×512 maskable placeholder)

For best installability across Android launchers, replace these with PNG exports using the
same sizes before production launch.

## Deployment

### Supabase Authentication URLs

Before launching a deployed app, lock Supabase Auth redirects to your production origin.
In Supabase Dashboard → Authentication → URL Configuration:

- Set `Site URL` to your deployed app origin, for example `https://your-app-domain.com`.
- Add an allowed redirect URL for the deployed app, for example
  `https://your-app-domain.com/**`.
- Add local development URLs only when needed, such as `http://localhost:5173/**`.

This keeps signup, login, and invite-link redirects constrained to trusted app origins.

## Cron & Notifications

Phase 14 includes a logging-only reminder function. It does not send email. It checks
expiring pantry items, respects each user's `notification_preferences`, and inserts
idempotent rows into `expiration_reminder_logs` with `delivery_status = 'logged'`.

### Deploy

Apply migrations through `0004_reminder_logs_logged_status.sql`, then deploy:

```bash
supabase functions deploy send-expiration-reminders
```

The function is configured in `supabase/config.toml` with `verify_jwt = false` so it can
be called by Supabase cron. It uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
the Supabase Edge Function runtime.

### Schedule

Preferred path: Supabase Dashboard → Edge Functions → Scheduled Functions. Schedule
`send-expiration-reminders` daily at `09:00 UTC`.

SQL option with `pg_cron` and `pg_net`:

```sql
select cron.schedule(
  'pantrysync-expiration-reminders',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.functions.supabase.co/send-expiration-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Manual Test

Create a pantry item expiring exactly 7 days from today and ensure your preference
`notify_7_days_before` is on. Then run:

```bash
curl -i \
  -X POST \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT_REF.functions.supabase.co/send-expiration-reminders \
  -d '{}'
```

Expected response:

```json
{ "processed": 1, "logged": 1, "skipped": 0, "failed": 0 }
```

Run it a second time the same day. `logged` should be `0` and the existing row should not
be duplicated because of the unique idempotency key.
