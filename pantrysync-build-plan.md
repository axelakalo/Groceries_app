# PantrySync — Build Plan (v2)

A phased, agent-resistant build plan for a household grocery + pantry expiration PWA. Designed to be fed section-by-section into Codex or Claude Code without the agent drifting or chaining phases.

---

## 0. App definition

**Name (provisional):** PantrySync

**What it is:** A secure PWA for a couple/household to share a grocery list, track pantry/fridge/freezer items with expiration dates, scan barcodes to autofill product metadata, and get reminded before items expire.

**What it isn't:** A native app, an App Store submission, a social network, an inventory system for restaurants, or a recipe app.

**Primary user:** You and one other person (your girlfriend). Design for that. Multi-tenant scale comes later, if ever.

### MVP feature list (final, do not expand)

1. Email/password auth
2. Household creation
3. Secure household invite (one other person)
4. Shared grocery list with realtime sync
5. Shared pantry inventory (manual entry)
6. Barcode scan → product metadata autofill
7. Manual expiration date entry (always required when item has one)
8. "Expiring soon" home dashboard
9. Add pantry item to grocery list (one tap)
10. Notification preferences (UI only in MVP; sending comes later)
11. PWA install support (iOS Safari + Android Chrome)
12. Supabase RLS enforcing household isolation

### Explicitly cut from MVP (was in v1, removed)

- **Activity event log.** Two-person household, low value, high write amplification. Add later if missed.
- **Multiple grocery lists per household.** Schema still supports it (via `list_id`), but UI shows one list.
- **Push notifications.** PWA push is inconsistent on iOS. Email-only when notifications ship.
- **Discord webhooks.** Out of scope for a shared household app.
- **Native `BarcodeDetector` fallback.** Use `html5-qrcode` only. Safari doesn't have BarcodeDetector and Safari is the primary target.

---

## 1. Tech stack

**Frontend**
- Vite + React + TypeScript
- Tailwind CSS
- React Router
- `@supabase/supabase-js`
- `date-fns`
- `html5-qrcode` (barcode scanning)
- `vite-plugin-pwa`

**Backend**
- Supabase Auth (email/password)
- Supabase Postgres
- Supabase Row Level Security
- Supabase Edge Functions (Deno)
- Supabase Realtime (grocery list only)

**External**
- Open Food Facts API (server-side only, via Edge Function)
- Resend (email reminders, when notifications ship)

**Hosting:** Vercel (start), custom domain later.

---

## 2. Project structure

```
pantry-sync/
├── public/
│   ├── icons/
│   ├── manifest.webmanifest
│   └── offline.html
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── common/
│   │   ├── grocery/
│   │   ├── pantry/
│   │   ├── scanner/
│   │   ├── household/
│   │   └── layout/
│   ├── features/
│   │   ├── auth/
│   │   ├── household/
│   │   ├── grocery/
│   │   ├── pantry/
│   │   ├── products/
│   │   ├── notifications/
│   │   └── settings/
│   ├── lib/
│   │   ├── supabaseClient.ts
│   │   ├── dates.ts
│   │   ├── barcode.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   ├── services/
│   │   ├── groceryService.ts
│   │   ├── pantryService.ts
│   │   ├── productService.ts
│   │   ├── householdService.ts
│   │   └── notificationService.ts
│   ├── types/
│   │   ├── database.ts
│   │   ├── grocery.ts
│   │   ├── pantry.ts
│   │   ├── product.ts
│   │   └── household.ts
│   ├── styles/
│   │   └── globals.css
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   ├── functions/
│   │   ├── create-household-invite/
│   │   ├── accept-household-invite/
│   │   ├── send-expiration-reminders/
│   │   └── lookup-product/
│   └── seed.sql
├── .env.example
├── package.json
├── README.md
└── CLAUDE.md
```

---

## 3. CLAUDE.md (project instructions)

Put this in the repo root. Agents read this on every task.

```markdown
# PantrySync — Project Instructions for Coding Agents

## What this is
A PWA for a household (2 people) to share a grocery list and track pantry expiration dates.
Mobile-first. Dark theme. Blue accent.

## Tech
Vite, React, TypeScript, Tailwind, React Router, Supabase (Auth + Postgres + RLS + Edge Functions),
Open Food Facts (server-side only), html5-qrcode, date-fns, vite-plugin-pwa.

## Non-negotiable rules

1. **PWA only.** No native code, no Capacitor, no App Store assumptions.
2. **No secrets in the frontend.** Service role key, Resend API key, and any provider keys
   live in Edge Function env vars only. The anon key is the only Supabase key in the client.
3. **RLS is the source of truth for authorization.** The frontend never decides who can read what.
   Every household-scoped table has RLS enabled with policies that check membership via the
   `is_household_member()` SECURITY DEFINER function (see schema).
4. **`household_id` is never user-editable in forms.** It is derived from the active household
   context on the server side or via RLS.
5. **Expiration date is always manually typed or selected.** Barcode lookup fills product
   metadata (name, brand, image, category) only — never expiration.
6. **Expiration is nullable.** Some items (salt, sugar, vinegar) don't expire. NULL means
   "doesn't expire" and those items are excluded from expiring-soon queries.
7. **Service worker caches static assets only.** Never cache `*.supabase.co` responses,
   never cache auth tokens, never cache household data.
8. **Realtime is scoped to the grocery list.** Pantry uses refetch-on-focus.
9. **Camera access only on explicit user gesture.** iOS Safari will refuse otherwise.
10. **All saved dates are ISO `YYYY-MM-DD` strings.** All date parsing goes through `src/lib/dates.ts`.
11. **Barcodes are validated:** digits only, 8–14 characters, after stripping spaces/hyphens.
12. **Per-phase work only.** Do not chain phases together in a single response. Stop after
    the phase's acceptance checks and wait for the user to verify.

## UI conventions
- Mobile-first, dark background, rounded cards, blue accent.
- Bottom tab navigation on mobile, sidebar on desktop ≥ 768px.
- Large tap targets (min 44×44pt).
- Toasts for confirmations. Modals for destructive actions.
- Empty states are always written (no blank screens).
- Loading states are skeleton-based, not spinners.

## Before completing any task
- `npm run typecheck` passes (or `tsc --noEmit`).
- `npm run lint` passes if configured.
- No `console.log` left in production paths.
- No secrets in committed files.
- If DB changed: migration written, RLS policies updated, helper function used (no inline
  `exists` subqueries on `household_members` from policies on `household_members` itself —
  that recurses).
- Summary of changed files + manual test steps at the end of the response.
```

---

## 4. Database schema

### Conventions

- All primary keys are `uuid` with `default gen_random_uuid()`.
- All tables have `created_at timestamptz not null default now()`.
- Tables that can change have `updated_at timestamptz not null default now()` with a trigger.
- All foreign keys use `on delete cascade` for household-owned data; `on delete set null` for actor references where the record should outlive the actor.
- All money/quantity columns use `numeric`, never `float`.

### `set_updated_at()` trigger function (define once)

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

Attach via trigger to every table with an `updated_at` column:

```sql
create trigger trg_<table>_updated_at
before update on public.<table>
for each row execute function public.set_updated_at();
```

### `is_household_member()` helper (critical — prevents RLS recursion)

```sql
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
```

```sql
create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid() and role = 'owner'
  );
$$;

revoke all on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_owner(uuid) to authenticated;
```

**Why `SECURITY DEFINER`:** these functions need to read `household_members` without triggering the RLS policy on that table. If you use an inline `exists (select 1 from household_members ...)` in a policy on `household_members`, you recurse infinitely.

### Tables

#### `profiles`
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `households`
```sql
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `household_members`
```sql
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index idx_household_members_user on public.household_members(user_id);
create index idx_household_members_household on public.household_members(household_id);
```

#### `household_invites`
```sql
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_invites_household on public.household_invites(household_id);
create index idx_invites_token on public.household_invites(token_hash);
```

**Token storage rule:** the raw token is generated server-side (32 bytes from `crypto.getRandomValues`, base64url-encoded), sent to the inviter once, and stored only as SHA-256 hash. The raw token never touches the database.

#### `grocery_lists`
```sql
create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null default 'Main List',
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_grocery_lists_household on public.grocery_lists(household_id);
create unique index idx_grocery_lists_one_default
  on public.grocery_lists(household_id) where is_default = true;
```

The partial unique index enforces at most one default list per household.

#### `grocery_items`
```sql
create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  list_id uuid not null references public.grocery_lists(id) on delete cascade,
  name text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit text,
  category text,
  notes text,
  is_checked boolean not null default false,
  added_by uuid not null references auth.users(id) on delete cascade,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_grocery_items_household on public.grocery_items(household_id);
create index idx_grocery_items_list on public.grocery_items(list_id);
create index idx_grocery_items_unchecked
  on public.grocery_items(household_id, is_checked) where is_checked = false;
```

#### `products`
```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text unique,
  name text not null,
  brand text,
  image_url text,
  category text,
  source text not null check (source in ('manual', 'open_food_facts')),
  raw_source jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_barcode on public.products(barcode);
```

**Write rule:** inserts go through the `lookup-product` Edge Function only. Frontend cannot write to `products` directly. This prevents race conditions on `barcode` uniqueness and prevents users from polluting the global table.

#### `pantry_items`
```sql
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  custom_name text,
  quantity numeric not null default 1 check (quantity > 0),
  unit text,
  category text,
  storage_location text not null default 'pantry'
    check (storage_location in ('pantry', 'fridge', 'freezer', 'other')),
  bought_date date not null default current_date,
  expiration_date date, -- nullable: NULL means "doesn't expire"
  has_expiration boolean not null default true,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'used', 'discarded')),
  added_by uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz,
  discarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (custom_name is not null or product_id is not null),
  check ((has_expiration = false and expiration_date is null)
      or (has_expiration = true and expiration_date is not null)),
  check (expiration_date is null or expiration_date >= bought_date - interval '1 day')
);

create index idx_pantry_items_household on public.pantry_items(household_id);
create index idx_pantry_items_active_expiring
  on public.pantry_items(household_id, expiration_date)
  where status = 'active' and expiration_date is not null;
```

Notes:
- `expiration_date` is **nullable**. The `has_expiration` flag makes the user's intent explicit so we don't confuse "no expiration" with "user forgot to enter one."
- The status enum dropped `'expired'` — that's a derived state from `expiration_date < today`, not a stored one. Storing it creates drift.
- The `bought_date - interval '1 day'` check allows same-day expiration without timezone foot-guns.

#### `notification_preferences`
```sql
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notify_30_days_before boolean not null default false,
  notify_7_days_before boolean not null default true,
  notify_2_days_before boolean not null default true,
  notify_on_expiration_day boolean not null default true,
  email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);
```

Defaults changed: 30-day off (too noisy), 2-day on (more useful).

#### `expiration_reminder_logs`
```sql
create table public.expiration_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pantry_item_id uuid not null references public.pantry_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('30_day', '7_day', '2_day', 'day_of')),
  reminder_date date not null,
  sent_at timestamptz not null default now(),
  delivery_status text not null check (delivery_status in ('sent', 'failed', 'skipped')),
  unique (pantry_item_id, user_id, reminder_type, reminder_date)
);
```

Idempotency key: `(pantry_item_id, user_id, reminder_type, reminder_date)`. Prevents duplicate reminders if the cron runs twice.

### Removed from v1
- `activity_events` — cut from MVP
- `device_tokens` — push notifications cut from MVP

---

## 5. RLS policies

Enable RLS on every public table:

```sql
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.grocery_lists enable row level security;
alter table public.grocery_items enable row level security;
alter table public.products enable row level security;
alter table public.pantry_items enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.expiration_reminder_logs enable row level security;
```

### Policy patterns

#### `profiles`
```sql
create policy "users read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "users update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());
```

#### `households`
```sql
create policy "members read their households"
  on public.households for select
  using (public.is_household_member(id));

create policy "authenticated users create household"
  on public.households for insert
  with check (created_by = auth.uid());

create policy "owners update household"
  on public.households for update
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

create policy "owners delete household"
  on public.households for delete
  using (public.is_household_owner(id));
```

#### `household_members` (the tricky one)

Because `is_household_member()` is `SECURITY DEFINER`, it bypasses RLS on `household_members` and does not recurse.

```sql
create policy "members read membership rows of their households"
  on public.household_members for select
  using (public.is_household_member(household_id));

create policy "owners insert members"
  on public.household_members for insert
  with check (
    -- creating self as owner during household creation
    (user_id = auth.uid() and role = 'owner')
    -- or owner adding someone (accept-invite Edge Function uses service role, bypasses this)
    or public.is_household_owner(household_id)
  );

create policy "users remove themselves"
  on public.household_members for delete
  using (user_id = auth.uid());

create policy "owners remove members"
  on public.household_members for delete
  using (public.is_household_owner(household_id) and user_id != auth.uid());
```

Adding via invite goes through the `accept-household-invite` Edge Function using the service role, which bypasses these policies entirely. The owner-insert policy exists for direct add flows we might build later.

#### `household_invites`
```sql
create policy "owners read invites"
  on public.household_invites for select
  using (public.is_household_owner(household_id));

-- Creation/acceptance go through Edge Functions only.
-- No insert/update policies for the frontend — service role handles it.
```

#### `grocery_lists`
```sql
create policy "members select lists"
  on public.grocery_lists for select
  using (public.is_household_member(household_id));

create policy "members insert lists"
  on public.grocery_lists for insert
  with check (public.is_household_member(household_id) and created_by = auth.uid());

create policy "members update lists"
  on public.grocery_lists for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members delete lists"
  on public.grocery_lists for delete
  using (public.is_household_member(household_id));
```

#### `grocery_items`
```sql
create policy "members select items"
  on public.grocery_items for select
  using (public.is_household_member(household_id));

create policy "members insert items"
  on public.grocery_items for insert
  with check (public.is_household_member(household_id) and added_by = auth.uid());

create policy "members update items"
  on public.grocery_items for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members delete items"
  on public.grocery_items for delete
  using (public.is_household_member(household_id));
```

#### `products`
```sql
create policy "authenticated users read products"
  on public.products for select
  to authenticated
  using (true);

-- No insert/update/delete policies for the frontend.
-- The lookup-product Edge Function uses service role to write.
```

#### `pantry_items`
```sql
create policy "members select pantry"
  on public.pantry_items for select
  using (public.is_household_member(household_id));

create policy "members insert pantry"
  on public.pantry_items for insert
  with check (public.is_household_member(household_id) and added_by = auth.uid());

create policy "members update pantry"
  on public.pantry_items for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members delete pantry"
  on public.pantry_items for delete
  using (public.is_household_member(household_id));
```

#### `notification_preferences`
```sql
create policy "users select own prefs"
  on public.notification_preferences for select
  using (user_id = auth.uid());

create policy "users insert own prefs"
  on public.notification_preferences for insert
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy "users update own prefs"
  on public.notification_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own prefs"
  on public.notification_preferences for delete
  using (user_id = auth.uid());
```

#### `expiration_reminder_logs`
```sql
create policy "users read own reminder logs"
  on public.expiration_reminder_logs for select
  using (user_id = auth.uid());

-- Inserts only via send-expiration-reminders Edge Function (service role).
```

### RLS test plan (run after migration)

With two test users A and B, A in Household 1, B in Household 2:
- A cannot SELECT B's households, members, grocery items, pantry items, or invites.
- A cannot INSERT a grocery item with `household_id` = B's household.
- A cannot UPDATE a pantry item belonging to B.
- A cannot read B's notification preferences.
- Anonymous (no JWT) cannot read anything except the products table (and only if authenticated — fix this if anon access is granted).

Write these as SQL scripts in `supabase/tests/` and document running them.

---

## 6. Build phases

Each phase has: goal, prompt, acceptance checks. Agents **stop after a phase** and wait for verification.

### Phase 1 — Project scaffold

**Goal:** Vite + React + TS + Tailwind running with placeholder routes.

**Prompt:**
```
Initialize a Vite + React + TypeScript project named pantry-sync.

Install: tailwindcss, postcss, autoprefixer, react-router-dom, @supabase/supabase-js,
date-fns. Do NOT install html5-qrcode or vite-plugin-pwa yet — those come in later phases.

Create the folder structure exactly as specified in section 2 of the build plan.

Create these files:
- src/lib/supabaseClient.ts (reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from env;
  throws a clear error if either is missing)
- src/app/router.tsx with placeholder routes: /, /login, /signup, /app, /app/grocery,
  /app/pantry, /app/scan, /app/settings
- src/app/App.tsx, src/main.tsx
- src/styles/globals.css with Tailwind directives and a dark theme baseline
- .env.example with VITE_SUPABASE_URL= and VITE_SUPABASE_ANON_KEY=
- README.md with setup steps
- CLAUDE.md (use the content from section 3 of the build plan verbatim)

Dark theme baseline: bg-zinc-950 background, text-zinc-100 default text, blue-500 accent.
Mobile-first.

Configure Tailwind for src/**/*.{ts,tsx}.

Do not implement auth, database, or business logic in this phase.
Stop after running `npm run dev` and confirming the placeholder pages render.
```

**Acceptance checks:**
- [ ] `npm install` succeeds with no peer dep errors.
- [ ] `npm run dev` serves the app on localhost.
- [ ] All seven routes render placeholder text.
- [ ] Tailwind classes apply (verify with a `bg-blue-500` element).
- [ ] `.env.example` exists; no real keys committed.
- [ ] `CLAUDE.md` exists in repo root.

---

### Phase 2 — Supabase schema migration

**Goal:** All tables, triggers, helper functions, and indexes created. RLS enabled (policies in next phase).

**Prompt:**
```
Create a Supabase migration at supabase/migrations/0001_initial_schema.sql containing:

1. The `set_updated_at()` trigger function.
2. The `is_household_member(uuid)` and `is_household_owner(uuid)` SECURITY DEFINER functions
   with `set search_path = public` and grants to `authenticated`.
3. All tables from section 4 of the build plan: profiles, households, household_members,
   household_invites, grocery_lists, grocery_items, products, pantry_items,
   notification_preferences, expiration_reminder_logs.
4. All check constraints, foreign keys, unique constraints, and indexes specified.
5. The `updated_at` trigger attached to every table with that column.
6. `alter table ... enable row level security` on every public table.
7. The partial unique index on grocery_lists for is_default.

Do NOT add RLS policies in this migration — that goes in 0002.
Do NOT seed data.

After writing the migration, produce a short summary of each table and its purpose.
Confirm the migration applies cleanly against a fresh Supabase project.
```

**Acceptance checks:**
- [ ] Migration applies cleanly on a fresh Supabase project (`supabase db reset` locally or via dashboard).
- [ ] All tables visible in Supabase Studio.
- [ ] RLS enabled on every table (Studio shows the lock icon).
- [ ] Helper functions exist and are callable.
- [ ] `expiration_date` is nullable; `has_expiration` defaults to true.
- [ ] No `activity_events` or `device_tokens` table (cut from MVP).

---

### Phase 3 — RLS policies

**Goal:** Households are isolated. User A cannot see User B's data.

**Prompt:**
```
Create supabase/migrations/0002_rls_policies.sql containing every policy from section 5
of the build plan, in order.

Rules:
- Use `public.is_household_member(...)` and `public.is_household_owner(...)` — never
  inline `exists` subqueries against household_members from a household_members policy.
- Each policy specifies the role (`to authenticated` where appropriate).
- Insert policies include `with check` that verifies `added_by = auth.uid()` or
  `created_by = auth.uid()` where the schema has that column.
- Do NOT create insert/update/delete policies for `products` or `expiration_reminder_logs`
  or `household_invites` — those are written only by Edge Functions with the service role.

Also create supabase/tests/rls_test.sql with the test plan from section 5:
two synthetic users, two households, scripted SELECT/INSERT/UPDATE attempts that should
fail. Document how to run it.

After the migration, summarize each policy in plain English.
```

**Acceptance checks:**
- [ ] Migration applies cleanly.
- [ ] Two synthetic users in separate households: A cannot read B's data via any table.
- [ ] A cannot insert a grocery_item with `household_id` set to B's household.
- [ ] Anonymous (no JWT) cannot read profiles, households, grocery_items, or pantry_items.
- [ ] Authenticated users can read products.
- [ ] The `household_members` policy does not recurse (no "stack depth exceeded" error).

---

### Phase 4 — Auth UI

**Goal:** Sign up, log in, log out, session persistence, protected routes.

**Prompt:**
```
Implement Supabase email/password auth.

Create:
- src/features/auth/AuthProvider.tsx — wraps the app, exposes user + session via context.
- src/features/auth/useAuth.ts — hook returning { user, session, loading, signIn, signUp,
  signOut }.
- src/features/auth/ProtectedRoute.tsx — redirects to /login if no session; shows skeleton
  while loading.
- src/features/auth/LoginPage.tsx, src/features/auth/SignupPage.tsx — mobile-first forms,
  blue accent, error states, loading states.

On successful signup:
- Upsert a row in `profiles` with id = user.id, email = user.email, display_name = null.
- Redirect to /app/onboarding (does not exist yet — that's Phase 5).

On successful login:
- Redirect to /app.

Session persistence: rely on Supabase's default localStorage persistence. Do NOT add
custom token storage.

Wrap the router in AuthProvider. Wrap /app routes in ProtectedRoute.

Error messages must be human-readable. Map Supabase error codes to friendly text where
they would otherwise leak internals.
```

**Acceptance checks:**
- [ ] Sign up creates an auth user and a profile row.
- [ ] Log in works.
- [ ] Log out clears session and redirects to /login.
- [ ] Refreshing /app/grocery while logged in stays on the page.
- [ ] Refreshing /app/grocery while logged out redirects to /login.
- [ ] Wrong password shows a friendly error, not a raw Supabase message.
- [ ] No `console.log` of tokens or user objects.

---

### Phase 5 — Household onboarding

**Goal:** New user lands on onboarding, creates a household, gets default list + prefs.

**Prompt:**
```
Implement household onboarding.

Create:
- src/features/household/OnboardingPage.tsx at /app/onboarding — two cards: "Create a
  household" and "Join with an invite link" (the join card is a placeholder for Phase 17;
  show "Coming soon").
- src/features/household/CreateHouseholdForm.tsx — single field (name), submit button.
- src/services/householdService.ts with:
    - `getMyHouseholds()` — returns households the current user is a member of
    - `getActiveHousehold()` — returns the first household; we don't support switching in MVP
    - `createHousehold(name)` — creates household, adds creator as owner, creates default
      grocery list, creates notification_preferences row. Must be transactional.
    - `getHouseholdMembers(householdId)`

Transactional creation: since the frontend can't do multi-statement transactions over the
REST API, write a Supabase RPC function `create_household_with_defaults(name text)` that
does all four inserts in one transaction. Call that from `createHousehold()`.

Routing logic in /app:
- If `getMyHouseholds()` returns empty → redirect to /app/onboarding.
- Else → render the main app shell (Phase 6).

Use an `ActiveHouseholdProvider` (src/features/household/ActiveHouseholdProvider.tsx) that
loads the active household once and exposes it via context.
```

**Acceptance checks:**
- [ ] New user lands on /app/onboarding after signup.
- [ ] Creating a household creates exactly one row in each of: households, household_members,
      grocery_lists (with is_default = true), notification_preferences.
- [ ] The RPC function exists and is the only path that writes those four rows together.
- [ ] After creation, user lands on /app and the active household name is visible.
- [ ] Refreshing /app with an existing household does not redirect to onboarding.

---

### Phase 6 — App shell + navigation

**Goal:** Bottom tabs on mobile, sidebar on desktop, consistent header.

**Prompt:**
```
Build the main app shell.

Create:
- src/components/layout/AppShell.tsx — wraps /app/* routes, includes header and nav.
- src/components/layout/Header.tsx — shows app name (left), active household name (center),
  settings icon (right).
- src/components/layout/BottomTabNav.tsx — visible on screens < 768px. Tabs: Home, Grocery,
  Pantry, Scan, Settings.
- src/components/layout/Sidebar.tsx — visible on screens ≥ 768px. Same tabs, vertical.
- src/components/common/EmptyState.tsx — accepts icon, title, description, optional action.
- src/components/common/LoadingSkeleton.tsx — generic skeleton block.
- src/components/common/ErrorState.tsx — accepts error + retry callback.

Style:
- Dark zinc-950 background, white text, blue-500 accent.
- Cards: bg-zinc-900, rounded-2xl, p-4.
- Tap targets minimum 44px.
- Active tab: blue-500 icon + text. Inactive: zinc-400.

No business logic — just the shell, navigation, and placeholder pages for each tab.
```

**Acceptance checks:**
- [ ] Bottom tabs work on mobile width.
- [ ] Sidebar works on desktop width.
- [ ] Header shows app name and active household name.
- [ ] All five tab routes render their placeholder.
- [ ] Active tab is visually distinct.
- [ ] Layout doesn't overflow on iPhone SE width (375px).

---

### Phase 7 — Grocery list

**Goal:** Add, edit, check, delete grocery items. Realtime sync between two sessions.

**Prompt:**
```
Implement the shared grocery list.

Create:
- src/services/groceryService.ts:
    - listItems(listId)
    - addItem({ listId, name, quantity, unit, category, notes })
    - updateItem(id, patch)
    - toggleChecked(id, isChecked) — sets checked_by and checked_at on check; clears them on uncheck
    - deleteItem(id)
- src/features/grocery/useGroceryItems.ts — hook that loads items for the active
  household's default list, subscribes to Supabase Realtime on the grocery_items table
  filtered by household_id, and merges updates into state.
- src/features/grocery/GroceryPage.tsx at /app/grocery.
- src/components/grocery/GroceryItemRow.tsx — checkbox, name, qty/unit, edit + delete buttons.
- src/components/grocery/AddItemSheet.tsx — bottom sheet on mobile, modal on desktop. Fields:
  name (required), quantity (default 1), unit, category, notes.
- src/components/grocery/EditItemSheet.tsx — same fields.

Behavior:
- Unchecked items at top, checked items at bottom with strikethrough.
- Checking an item is optimistic: update local state immediately, send the request, revert
  on error with a toast.
- Realtime: when the other user adds/checks/deletes, this user's screen updates within ~1s.
- Sort within each group: by created_at desc.
- Empty state when no items.

Realtime subscription must filter on household_id so each user only receives their
household's events. Use Supabase's `channel().on('postgres_changes', { filter: 'household_id=eq.X' })`.

Do NOT let the user edit `household_id`, `list_id`, `added_by`, `checked_by`, or
`checked_at` directly. These are set by the service layer.
```

**Acceptance checks:**
- [ ] Add an item — appears immediately.
- [ ] Open the app in a second browser as the other household member — see the item within 1s.
- [ ] Check an item in browser A — strikethrough appears in browser B within 1s.
- [ ] Uncheck restores item to the unchecked group.
- [ ] Edit name/quantity persists and syncs.
- [ ] Delete confirms and syncs.
- [ ] Realtime channel filters by household_id (verify by checking subscription payload in DevTools).
- [ ] Empty state renders when list is empty.

---

### Phase 8 — Pantry manual entry

**Goal:** Add, edit, status-change pantry items with proper date handling and the "doesn't expire" path.

**Prompt:**
```
Implement the pantry feature.

First, create src/lib/dates.ts with these exports (and a small test file):

- parseUserDateInput(input: string): string | null
  Accepts: MM/DD/YYYY, M/D/YYYY, MM/DD/YY, M/D/YY, YYYY-MM-DD.
  Returns ISO YYYY-MM-DD string or null if invalid.
  Two-digit years: 00–49 → 20YY, 50–99 → 19YY.
  Validates the date is real (no Feb 30).

- normalizeDateForDb(date: Date): string
  Returns local-date YYYY-MM-DD (NOT UTC). Use the user's local timezone.

- formatDisplayDate(iso: string): string
  Returns "Mon, Mar 12" for current year, "Mar 12, 2027" for other years.

- getDaysUntil(iso: string): number
  Returns local-day difference. Today = 0, tomorrow = 1, yesterday = -1.

- getExpirationStatus(iso: string | null): 'no_expiration' | 'expired' | 'today' | 'soon' | 'month' | 'safe'
  null → 'no_expiration', <0 → 'expired', 0 → 'today', 1–7 → 'soon', 8–30 → 'month', >30 → 'safe'.

Write Vitest unit tests for each function. Cover edge cases: leap years, Dec 31 → Jan 1,
two-digit year boundary at 50.

Then implement pantry:

- src/services/pantryService.ts: list, add, update, delete, markUsed, markDiscarded, restore.
- src/features/pantry/usePantryItems.ts — loads items, refetches on focus and on tab
  change. NO realtime subscription (per the rules in CLAUDE.md).
- src/features/pantry/PantryPage.tsx at /app/pantry.
- src/components/pantry/PantryItemCard.tsx — shows name, location badge, expiration badge
  with color (green/yellow/orange/red), quick actions (Used, Discarded, Add to Grocery,
  Edit, Delete).
- src/components/pantry/AddPantryItemSheet.tsx — fields:
    - name (required)
    - quantity (default 1)
    - unit
    - category
    - storage_location (pantry/fridge/freezer/other, default pantry)
    - bought_date (default today, editable)
    - has_expiration toggle (default ON)
    - expiration_date (required when has_expiration is ON, hidden when OFF) — text input
      that pipes through parseUserDateInput on blur, with a native date picker as fallback
- src/components/pantry/PantryFilters.tsx — All, Expiring soon (≤7d), Expired, By location
  (pantry/fridge/freezer), Used, Discarded.
- src/components/pantry/ExpirationBadge.tsx — uses getExpirationStatus and renders an
  appropriate color + label ("3 days left", "Expired 2 days ago", "No expiration", etc.).

Validation:
- If has_expiration is ON and expiration_date is missing or unparseable: block save with
  inline error.
- If expiration_date < bought_date: show warning, require explicit confirmation.
- If already-expired on save: show warning, allow with confirmation (use case: tracking
  things you forgot about).

The "Add to Grocery" action is wired in Phase 9.
```

**Acceptance checks:**
- [ ] Vitest tests for `src/lib/dates.ts` all pass.
- [ ] Adding an item with expiration works.
- [ ] Adding an item with `has_expiration` OFF saves with null expiration_date and shows "No expiration" badge.
- [ ] Date input accepts MM/DD/YYYY and YYYY-MM-DD; rejects 13/45/2026.
- [ ] Expiration before bought_date triggers a warning.
- [ ] Mark Used sets status='used' and used_at; item moves to Used filter.
- [ ] Mark Discarded sets status='discarded' and discarded_at; item moves to Discarded filter.
- [ ] Filters work and counts are accurate.
- [ ] Refetch on focus: open in two tabs, add in one, switch to the other tab → list updates.

---

### Phase 9 — Home dashboard + pantry-to-grocery

**Goal:** Useful first screen; one-tap "add to grocery list" from pantry.

**Prompt:**
```
Build the home dashboard at /app.

Create:
- src/features/home/HomePage.tsx
- src/components/home/ExpiringSection.tsx — accepts a list of items and a title
- src/components/home/QuickActions.tsx — three buttons: Add to Grocery, Add to Pantry, Scan

Dashboard contents (in order):
1. Greeting: "Good morning/afternoon/evening, {display_name or 'there'}"
2. Quick Actions row
3. "Expiring today" (if any) — red accent
4. "Expiring this week" (1–7 days) — orange accent — show up to 5
5. "Expiring this month" (8–30 days) — yellow accent — collapsed by default, expandable
6. "Grocery list" summary — count of unchecked items, link to grocery page

Each pantry item shown has an "Add to grocery" button.

Then implement the pantry → grocery shortcut:

- src/services/groceryService.ts gets a new function: addFromPantryItem(pantryItem)
  - Inserts a grocery_item into the default list with:
      - name = pantryItem.custom_name ?? pantryItem.product?.name
      - quantity = pantryItem.quantity
      - unit = pantryItem.unit
      - category = pantryItem.category
      - notes = "Restock — pantry item expired/expiring {date}" (use formatDisplayDate)
  - Before inserting, check for an existing unchecked grocery_item in the default list
    with the same lowercased name. If found, prompt: "Already on your list. Add another?"
- Wire this to the "Add to grocery" button on PantryItemCard and the dashboard.
- Show a toast on success: "Added {name} to grocery list".

No new tables. No new RLS.
```

**Acceptance checks:**
- [ ] Dashboard loads in <1s on a household with 20 pantry items.
- [ ] Expiring sections show correct items and counts.
- [ ] "Expiring this month" collapsed by default.
- [ ] "Add to grocery" from a pantry card creates the item and shows toast.
- [ ] Duplicate detection prompts before creating a second copy.
- [ ] Quick action buttons navigate correctly.
- [ ] Empty state: "Nothing expiring soon. Nice work."

---

### Phase 10 — Product lookup Edge Function

**Goal:** Server-side Open Food Facts lookup with upsert. Frontend never touches OFF directly.

**Prompt:**
```
Create the Edge Function supabase/functions/lookup-product/index.ts.

Behavior:
1. Requires JWT (verify_jwt = true in config.toml).
2. Accepts POST with { barcode: string }.
3. Validates: digits only, 8–14 chars after stripping spaces/hyphens. 400 on invalid.
4. Queries the local `products` table for a matching barcode using service role client.
5. If found, returns it with `{ product, source: 'local' }`.
6. If not found, calls Open Food Facts:
     GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
   With a User-Agent header: "PantrySync/1.0 (https://your-domain)"
7. If OFF returns status 1 (product found), normalize:
     - barcode: input barcode
     - name: product.product_name || product.generic_name || 'Unknown product'
     - brand: product.brands?.split(',')[0]?.trim() ?? null
     - image_url: product.image_front_url ?? product.image_url ?? null
     - category: product.categories_tags?.[0]?.replace(/^en:/, '') ?? null
     - source: 'open_food_facts'
     - raw_source: { off_status: data.status, code: data.code }  -- store minimal, not the whole blob
8. Upsert into products: `insert ... on conflict (barcode) do update set ... returning *`.
   Use the service role client.
9. Return { product, source: 'open_food_facts' }.
10. If OFF returns status 0 (not found), return { product: null, source: 'not_found' } with 200.

Errors:
- OFF unreachable or 5xx: return 200 with { product: null, source: 'lookup_failed' }
  and let the frontend offer manual entry.
- Anything else unexpected: 500 with a generic message (no internal details).

Add a corresponding frontend service:
- src/services/productService.ts:
    - lookupByBarcode(barcode: string): Promise<{ product, source }>
    - createManualProduct({ barcode, name, brand?, category? }) — calls a second Edge
      Function `create-manual-product` that does the same upsert pattern with source='manual'.

Validate barcode client-side too, before calling the function, via src/lib/barcode.ts:
- isValidBarcode(value: string): boolean
- normalizeBarcode(value: string): string  (strip spaces/hyphens)

DO NOT call Open Food Facts from the browser.
DO NOT let the frontend insert into `products` directly.
```

**Acceptance checks:**
- [ ] Calling `lookupByBarcode` with a known OFF barcode (e.g., a Coca-Cola can) returns a normalized product.
- [ ] The same barcode is now in the local `products` table.
- [ ] Calling again returns `source: 'local'`.
- [ ] Invalid barcode (letters, too short) gets rejected client-side, never hits the function.
- [ ] Unknown barcode returns `{ product: null, source: 'not_found' }`.
- [ ] OFF outage simulated → returns `source: 'lookup_failed'`, frontend can recover.
- [ ] No direct fetch to `openfoodfacts.org` from `src/**`.
- [ ] No RLS policy allows frontend insert into `products`.

---

### Phase 11 — Barcode scanner UI

**Goal:** Scan → lookup → confirm → add to pantry, with manual entry fallback.

**Prompt:**
```
Install html5-qrcode.

Create:
- src/features/scan/ScanPage.tsx at /app/scan.
- src/components/scanner/BarcodeScanner.tsx — wraps html5-qrcode. Starts only on user
  gesture ("Start scanning" button). Stops on first successful detection. Provides clear
  permission-denied messaging on iOS Safari.
- src/components/scanner/ManualBarcodeEntry.tsx — number input + submit.
- src/components/scanner/ProductConfirmCard.tsx — shows looked-up product (or manual form
  if not found / lookup failed), with editable name/brand/category fields and image.
- src/components/scanner/PantryEntryForm.tsx — same fields as AddPantryItemSheet from
  Phase 8, prefilled with product metadata. Expiration date input is ALWAYS shown and
  required when has_expiration is on.

Flow:
1. User taps "Start scanning".
2. Camera opens with a viewfinder overlay.
3. Barcode detected → camera stops → barcode shown.
4. `lookupByBarcode(barcode)` called.
5. If `source = 'local'` or `'open_food_facts'`: show ProductConfirmCard with product
   prefilled. User can edit fields.
6. If `source = 'not_found'` or `'lookup_failed'`: show ProductConfirmCard with empty
   fields and a "Save as new product" path that calls `createManualProduct`.
7. User fills in pantry-specific fields (quantity, location, dates) in PantryEntryForm.
8. Save → creates a pantry_item linked to the product (or with custom_name if no product
   was confirmed).
9. Toast "Added {name} to pantry" → navigate to /app/pantry.

Also: provide a "Type barcode manually" button on the scan page that skips the camera
entirely.

iOS Safari notes:
- Request camera only after the user taps "Start scanning".
- If `getUserMedia` rejects, show "Camera access denied. You can still type the barcode
  manually." with the manual entry button.
- Camera must stop (stream tracks released) when leaving the page or after detection.
```

**Acceptance checks:**
- [ ] "Start scanning" requests camera permission only after tap.
- [ ] Scanning a Coca-Cola can fills the product card.
- [ ] Denied camera → manual entry path still works.
- [ ] Manual barcode entry skips the camera entirely.
- [ ] Unknown barcode → manual product form appears.
- [ ] Saved pantry item shows the OFF image (if any) and product name.
- [ ] Expiration date is required and validated, regardless of product lookup outcome.
- [ ] Leaving /app/scan stops the camera (check the indicator on mobile).

---

### Phase 12 — PWA install support

**Goal:** Installable on iOS and Android with safe caching.

**Prompt:**
```
Install vite-plugin-pwa.

Configure:
- registerType: 'autoUpdate'
- includeAssets: favicon, app icons
- manifest:
    - name: "PantrySync"
    - short_name: "PantrySync"
    - description: "Shared grocery list and pantry tracker"
    - theme_color: "#3b82f6"  (blue-500)
    - background_color: "#09090b"  (zinc-950)
    - display: "standalone"
    - start_url: "/app"
    - scope: "/"
    - orientation: "portrait"
    - icons: 192x192, 512x512, 512x512 maskable (placeholders OK — note in README to replace)
- workbox:
    - globPatterns: only static assets (JS, CSS, HTML, fonts, icons, images in /assets)
    - runtimeCaching: NONE (do not cache any API responses)
    - navigateFallback: '/index.html'
    - navigateFallbackDenylist: [/^\/api/, /supabase\.co/]

Caching rules (verified by reviewing the generated SW):
- Do NOT cache any URL containing 'supabase.co'.
- Do NOT cache /auth, /rest, /storage, /realtime endpoints.
- Cache only same-origin static assets.

Create:
- src/components/common/InstallPrompt.tsx — small banner shown on first visit, dismissible.
  - iOS Safari (detect via navigator.userAgent + standalone check): "Tap Share → Add to
    Home Screen to install."
  - Android Chrome: capture the `beforeinstallprompt` event and show an "Install" button.
- public/manifest.webmanifest reference in index.html.

Add a /app/settings entry "Install help" that always shows the instructions.
```

**Acceptance checks:**
- [ ] Lighthouse PWA audit passes the installability check.
- [ ] Android Chrome shows "Install" button via beforeinstallprompt.
- [ ] iOS Safari install instructions visible and accurate.
- [ ] After install, app opens standalone (no browser chrome).
- [ ] Offline: static shell loads; API calls fail gracefully (not silently cached stale).
- [ ] DevTools → Application → Cache Storage: no entries from supabase.co.
- [ ] Session works after reload while installed.

---

### Phase 13 — Notification preferences UI

**Goal:** User can configure reminders. Sending comes in Phase 14.

**Prompt:**
```
Implement notification preferences.

Create:
- src/services/notificationService.ts:
    - getMyPreferences(householdId)
    - updatePreferences(householdId, patch)
- src/features/notifications/PreferencesPage.tsx at /app/settings/notifications.

Fields (per the schema):
- notify_7_days_before (default ON)
- notify_2_days_before (default ON)
- notify_on_expiration_day (default ON)
- notify_30_days_before (default OFF)
- email_enabled (default ON)

Below the form: "Reminders are checked daily. We'll only email you when items are
actually expiring."

If the user has no preferences row for the active household (shouldn't happen because
onboarding creates one, but be defensive), create one with defaults on page load.

Add a link to this page from /app/settings.
```

**Acceptance checks:**
- [ ] Page loads current preferences.
- [ ] Toggling and saving persists.
- [ ] Another user in the same household sees their own preferences, not this user's.
- [ ] RLS blocks reading another user's preferences (confirm with a direct query attempt).

---

### Phase 14 — Reminder Edge Function (scaffold)

**Goal:** Cron-ready function that finds expiring items and logs reminders. Email sending is feature-flagged.

**Prompt:**
```
Create supabase/functions/send-expiration-reminders/index.ts.

Behavior:
1. Requires service role (no JWT). Called by Supabase cron (set up via SQL: pg_cron + pg_net,
   OR via Supabase scheduled functions — document whichever path is current).
2. Calculates target dates:
   - 30_day → today + 30 days
   - 7_day → today + 7 days
   - 2_day → today + 2 days
   - day_of → today
3. For each reminder type, query `pantry_items` where:
   - status = 'active'
   - has_expiration = true
   - expiration_date = target_date
4. For each item, join household_members and notification_preferences:
   - Skip users where the matching `notify_{type}` is false.
   - Skip users where `email_enabled` is false (for now, email is the only channel).
5. For each (item, user) pair:
   - Check expiration_reminder_logs for an existing row with the idempotency key
     (pantry_item_id, user_id, reminder_type, reminder_date = today).
   - If exists, skip.
   - Otherwise: insert a log row with delivery_status='skipped' if RESEND_API_KEY is unset,
     or actually send via Resend if it is.
6. Return a JSON summary: { processed, sent, skipped, failed }.

Email content (when RESEND_API_KEY is set):
- Subject: "{N} item(s) expiring soon in your pantry"
- Body: list of items with name, expiration date, days remaining. Plain HTML, no images.
- From: a configured FROM_EMAIL env var.

Env vars used:
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (provided by Supabase runtime)
- RESEND_API_KEY (optional)
- FROM_EMAIL (optional)

Document in README:
- How to deploy: `supabase functions deploy send-expiration-reminders`
- How to schedule daily at 09:00 UTC via Supabase cron (SQL snippet).
- How to test locally: `supabase functions serve` + a curl invocation.
- How email is dark-launched: without RESEND_API_KEY, the function logs and inserts
  with delivery_status='skipped' but doesn't actually send. Flip on by setting the env var.
```

**Acceptance checks:**
- [ ] Function deploys successfully.
- [ ] Running it manually with a seeded pantry item expiring in 7 days produces a log row.
- [ ] Running it twice the same day produces no duplicate log rows (idempotency works).
- [ ] Without RESEND_API_KEY: log rows have delivery_status='skipped'.
- [ ] With RESEND_API_KEY: actual email arrives (test with your own address).
- [ ] User with `notify_7_days_before = false` does not get a log row.
- [ ] Cron schedule documented and ideally configured.

---

### Phase 15 — Secure invite flow

**Goal:** Owner generates an invite link; the other person accepts and joins.

**Prompt:**
```
Create two Edge Functions:

supabase/functions/create-household-invite/index.ts
- Requires JWT.
- Accepts POST { household_id: uuid, invited_email?: string }.
- Verifies caller is owner of household_id (query household_members with service role).
- Generates 32 random bytes via crypto.getRandomValues, base64url-encodes them — this is
  the raw token (~43 chars, ~256 bits of entropy).
- Computes SHA-256(raw_token) → hex → stores as token_hash.
- expires_at = now() + 7 days.
- Returns { invite_url: `${APP_URL}/invite/{raw_token}`, expires_at }. Raw token is never
  stored.

supabase/functions/accept-household-invite/index.ts
- Requires JWT.
- Accepts POST { token: string }.
- Computes SHA-256(token) → hex.
- Looks up household_invites where token_hash = computed_hash AND used_at IS NULL AND
  expires_at > now(). 404 if not found.
- If invited_email is set, verify auth.user().email === invited_email (case-insensitive).
  403 if mismatch.
- Insert into household_members (household_id, user_id, role='member'). On conflict
  (user already a member): proceed without error.
- Insert into notification_preferences (defaults). On conflict: skip.
- Update invite: used_at = now(), used_by = auth.uid().
- Return { household_id, household_name }.

Frontend:
- src/features/household/InvitePage.tsx at /app/settings/invite — owner-only page,
  generates an invite link, shows it with a Copy button.
- src/features/household/AcceptInvitePage.tsx at /invite/:token — public route.
  - If not authenticated: redirect to /signup?next=/invite/{token}.
  - If authenticated: calls accept-household-invite, on success redirects to /app with
    a "Welcome to {household_name}" toast.
- Add an "Invite a household member" button on /app/settings if the user is an owner.

Security checks:
- Raw token never stored, never logged.
- token_hash column is unique (already in schema).
- Owner check is server-side, not based on a client-supplied role.
- Constant-time comparison: lookup by hash is fine since SHA-256 of random 256-bit input
  is collision-resistant.
```

**Acceptance checks:**
- [ ] Owner can generate an invite link. Token appears once in the response, never stored.
- [ ] Non-owner trying to generate an invite gets 403.
- [ ] Accepting a valid invite adds the user to household_members and notification_preferences.
- [ ] Accepting a used invite gets a clear error.
- [ ] Accepting an expired invite gets a clear error.
- [ ] If `invited_email` was set and user's email differs, accept fails with 403.
- [ ] Accepting while logged out redirects to signup, then completes the flow.
- [ ] Two users in the same household can now see the same grocery list and pantry.

---

### Phase 16 — Security audit

**Goal:** Last pass before showing the app to the other user.

**Prompt:**
```
Perform a security audit on the PantrySync codebase. Do not modify code yet — produce a
report ranked HIGH/MEDIUM/LOW with file:line references.

Check:

Secrets:
- No service role key, Resend key, or FROM_EMAIL in any file under src/.
- No `.env` committed. .env.example contains only placeholders.
- Edge Functions read secrets from env, not from client.

RLS:
- Every public table has RLS enabled.
- Every household-scoped table has SELECT, INSERT, UPDATE, DELETE policies (or
  intentionally omits some — document why).
- No policy on household_members uses an inline `exists (select 1 from household_members)`.
- The `is_household_member` and `is_household_owner` functions are SECURITY DEFINER and
  have `set search_path = public`.
- `products` has no INSERT/UPDATE/DELETE policies for frontend.
- `household_invites` has no INSERT/UPDATE policies for frontend.

Frontend trust:
- No form submits `household_id`, `added_by`, `created_by`, `checked_by`, `used_by`,
  `user_id` from user input — these are always set by the service layer from
  auth.user().id and the active household context.
- No service role client in src/.
- Supabase client uses anon key only.

Service worker:
- No runtimeCaching entries pointing at supabase.co.
- navigateFallbackDenylist excludes supabase.co.
- Cache Storage in DevTools contains no auth or household data.

Inputs:
- Barcode validated client-side (8–14 digits) AND server-side.
- Date inputs validated through src/lib/dates.ts.
- Quantity has a positive check constraint and client validation.

Invites:
- Raw token never stored, never logged.
- Token has at least 128 bits of entropy (256 in current impl).
- Hash uses SHA-256.
- Tokens expire (7 days).
- Tokens are single-use (used_at).

Auth:
- Supabase redirect URLs locked to the deployed origin (document in README, since this is
  a dashboard setting).
- Logout clears session.

Provide a checklist response with a HIGH/MEDIUM/LOW rating per finding and a concrete fix
suggestion. Stop after the report.
```

**Acceptance checks:**
- [ ] Report produced with no HIGH-severity unaddressed findings.
- [ ] All MEDIUM findings either fixed in a follow-up commit or explicitly accepted with rationale in README.
- [ ] Supabase dashboard auth redirect URLs configured.
- [ ] Cache Storage clean.

---

### Phase 17 — UI polish

**Goal:** Make the app feel finished before handoff.

**Prompt:**
```
Polish pass. No new features. No schema changes.

Focus areas:
- Empty states (every list has one, friendly tone)
- Loading skeletons (replace any remaining spinners)
- Toast positioning + auto-dismiss (use a single Toast provider)
- Modal/sheet animations (use Tailwind transitions, no jank)
- Form keyboard behavior on iOS (correct inputmode for numeric fields)
- Confirm dialogs for destructive actions (delete, mark discarded)
- Date inputs: inputmode="numeric" on the typed-date field
- Add a pull-to-refresh trigger on Pantry and Home pages (button or gesture — pick one)
- Settings page layout
- Auth page styling

Do not touch:
- Any RLS policy
- Any Edge Function
- Any service file business logic
- The schema

Produce a list of changed files and a screenshot description per page (e.g., "Home: now
shows greeting at top, three quick action buttons below, expiring sections with colored
left borders").
```

**Acceptance checks:**
- [ ] Every list page has an empty state.
- [ ] No spinners; loading uses skeletons.
- [ ] Destructive actions confirm.
- [ ] iOS keyboard shows number pad for quantity and date fields.
- [ ] No layout shift on first paint.
- [ ] Visual review on iPhone width (375px) and desktop (1280px): both look intentional.

---

### Phase 18 — Two-user end-to-end test

**Goal:** Real-world verification before launch.

**Test script (run with two accounts: A = you, B = the other person):**

```
Setup:
[ ] A signs up. B signs up. Both have profile rows.
[ ] A creates household "Home". A is owner.
[ ] A generates invite. B opens link, signs in if needed, accepts.
[ ] Settings → Members shows both A and B.

Grocery (realtime):
[ ] A adds "Milk, 2 gallons". B sees it within 2s.
[ ] B checks "Milk". A sees strikethrough within 2s.
[ ] A edits quantity to 1. B sees update.
[ ] B deletes. A's list updates.

Pantry (manual):
[ ] A adds "Oreos, expires 2026-08-15, pantry, qty 1". B sees it on next pantry visit (or focus refresh).
[ ] B marks Used. A sees on next refresh.
[ ] A adds "Salt" with has_expiration OFF. Pantry shows "No expiration" badge.

Barcode:
[ ] A scans a Coca-Cola can. Lookup populates name. A adds expiration date manually and saves.
[ ] B sees the new pantry item.
[ ] A scans an obscure regional product not in OFF. Manual fallback works.

Home dashboard:
[ ] A adds a pantry item expiring in 3 days. Home shows it under "This week".
[ ] A taps "Add to grocery" → grocery list gets the item with restock note.

Notifications:
[ ] A changes preferences: turn off 30-day, leave 7/2/day-of on.
[ ] Run send-expiration-reminders manually with a seeded item expiring in 7 days.
[ ] expiration_reminder_logs has exactly one row for A.
[ ] Run again same day: no new row.

Security:
[ ] Create a third account C, not in the household.
[ ] C cannot see A's grocery list, pantry, or invites (try direct REST calls in DevTools).
[ ] Logged-out: cannot access /app/grocery.

PWA:
[ ] A installs on iPhone via Share → Add to Home Screen.
[ ] B installs on Android via Install prompt.
[ ] Both open the app standalone, log in, use it.
[ ] Force-quit the app, reopen: session persists.
[ ] Airplane mode: shell loads, API calls show error states (not stale data).
```

If any check fails, file an issue, fix it in a small focused commit, retest.

---

## 7. Agent workflow

**Always:**
- One phase at a time. The CLAUDE.md rule "Per-phase work only" is non-negotiable.
- The agent uses the planning prompt before the implementation prompt for any phase with non-trivial UI or schema work.
- Commit after each successful phase. Don't bundle.

**Planning prompt template:**
```
Before coding, inspect the codebase and produce a short implementation plan for:

[PASTE PHASE]

Output only:
- Files to create
- Files to modify
- Database changes (if any)
- New dependencies (if any) and justification
- Security considerations
- Acceptance checks (copy from the phase)

Do not edit any files yet.
```

**Implementation prompt template:**
```
Implement the approved plan for:

[PASTE PHASE]

Constraints:
- Follow CLAUDE.md rules.
- Stop after this phase. Do not start the next phase.
- Keep changes scoped to the listed files.
- No new dependencies beyond what was approved.
- Add TypeScript types — no `any` unless absolutely unavoidable, and document why.
- Loading + error states for any new UI.

At the end:
- Summarize changed files (path + one-line description each).
- List manual test steps that exercise the acceptance checks.
```

**Debug prompt template:**
```
Error:
[PASTE ERROR + STEPS TO REPRODUCE]

Find the root cause. Propose the smallest fix. Do not rewrite unrelated code.

Output:
- Cause (one paragraph)
- Fix (specific file + lines)
- Verification steps
```

**Security prompt template:** see Phase 16.

**Branch + commit conventions:**
- Branch per phase: `feature/01-scaffold`, `feature/02-schema`, etc.
- Conventional commits: `feat:`, `fix:`, `security:`, `chore:`, `docs:`.
- PR (or local merge) per phase, after acceptance checks pass.

---

## 8. The single most important reminder

Paste this into the agent context every few prompts:

> The frontend is never trusted for authorization. Supabase RLS enforces household isolation. The frontend never sets `household_id`, `user_id`, `added_by`, or any actor field from user input. No service role keys or third-party API keys in the client. Camera and any device API request happens only on explicit user gesture. Stop after each phase and wait for verification.

That's the rule that protects everything else.

---

## 9. What you have after Phase 18

A PWA that:
- Two people can install on their phones in 60 seconds without an app store.
- Lets them share a grocery list with realtime sync.
- Lets them track pantry items with proper expiration date handling.
- Reads barcodes and fills product info from Open Food Facts.
- Reminds them daily (via email, once you set RESEND_API_KEY) before things expire.
- Has correct RLS, no leaked secrets, and clean caching.

What it won't do, by design:
- Push notifications (add later if needed)
- Multiple lists per household (schema supports it; UI doesn't expose it yet)
- Activity feed (cut)
- Recipe suggestions, shopping price tracking, household chores, calendar integration —
  all out of scope; resist the urge.

Ship Phase 18, use it for two weeks, then decide what's actually missing.
