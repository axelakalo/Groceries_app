create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

revoke all on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_owner(uuid) to authenticated;

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
  on public.grocery_lists(household_id)
  where is_default = true;

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
  on public.grocery_items(household_id, is_checked)
  where is_checked = false;

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
  expiration_date date,
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
  check (
    (has_expiration = false and expiration_date is null)
    or (has_expiration = true and expiration_date is not null)
  ),
  check (expiration_date is null or expiration_date >= bought_date - interval '1 day')
);

create index idx_pantry_items_household on public.pantry_items(household_id);
create index idx_pantry_items_active_expiring
  on public.pantry_items(household_id, expiration_date)
  where status = 'active'
    and expiration_date is not null;

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

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trg_households_updated_at
before update on public.households
for each row execute function public.set_updated_at();

create trigger trg_grocery_lists_updated_at
before update on public.grocery_lists
for each row execute function public.set_updated_at();

create trigger trg_grocery_items_updated_at
before update on public.grocery_items
for each row execute function public.set_updated_at();

create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger trg_pantry_items_updated_at
before update on public.pantry_items
for each row execute function public.set_updated_at();

create trigger trg_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

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
