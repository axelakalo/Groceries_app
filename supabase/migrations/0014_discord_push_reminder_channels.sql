alter table public.notification_preferences
  add column if not exists push_enabled boolean not null default false,
  add column if not exists discord_enabled boolean not null default false;

alter table public.expiration_reminder_logs
  add column if not exists channel text not null default 'email',
  add column if not exists error_message text;

alter table public.expiration_reminder_logs
  drop constraint if exists expiration_reminder_logs_delivery_status_check;

alter table public.expiration_reminder_logs
  add constraint expiration_reminder_logs_delivery_status_check
  check (delivery_status in ('pending', 'sent', 'failed', 'skipped', 'logged'));

alter table public.expiration_reminder_logs
  drop constraint if exists expiration_reminder_logs_channel_check;

alter table public.expiration_reminder_logs
  add constraint expiration_reminder_logs_channel_check
  check (channel in ('email', 'push', 'discord'));

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.expiration_reminder_logs'::regclass
    and contype = 'u'
    and conkey = (
      select array_agg(attnum order by attnum)
      from pg_attribute
      where attrelid = 'public.expiration_reminder_logs'::regclass
        and attname in ('pantry_item_id', 'user_id', 'reminder_type', 'reminder_date')
    );

  if constraint_name is not null then
    execute format(
      'alter table public.expiration_reminder_logs drop constraint %I',
      constraint_name
    );
  end if;
end $$;

create unique index if not exists idx_expiration_logs_unique_channel
  on public.expiration_reminder_logs(
    pantry_item_id,
    user_id,
    reminder_type,
    channel,
    reminder_date
  );

create index if not exists idx_expiration_logs_household_date
  on public.expiration_reminder_logs(household_id, reminder_date);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text not null default 'web',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions(user_id);

create index if not exists idx_push_subscriptions_household
  on public.push_subscriptions(household_id);

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;

create trigger trg_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "users select own push subscriptions"
  on public.push_subscriptions;

create policy "users select own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "users insert own push subscriptions"
  on public.push_subscriptions;

create policy "users insert own push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists "users update own push subscriptions"
  on public.push_subscriptions;

create policy "users update own push subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists "users delete own push subscriptions"
  on public.push_subscriptions;

create policy "users delete own push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

create table if not exists public.discord_integrations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  guild_id text,
  channel_id text,
  webhook_url text not null,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id)
);

create index if not exists idx_discord_integrations_household
  on public.discord_integrations(household_id);

drop trigger if exists trg_discord_integrations_updated_at on public.discord_integrations;

create trigger trg_discord_integrations_updated_at
before update on public.discord_integrations
for each row execute function public.set_updated_at();

alter table public.discord_integrations enable row level security;

drop policy if exists "members read discord integration status"
  on public.discord_integrations;

create policy "members read discord integration status"
  on public.discord_integrations for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "owners delete discord integrations"
  on public.discord_integrations;

create policy "owners delete discord integrations"
  on public.discord_integrations for delete
  to authenticated
  using (public.is_household_owner(household_id));
