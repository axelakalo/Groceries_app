create table public.favorite_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit text,
  category text,
  source_type text not null default 'manual'
    check (source_type in ('manual', 'auto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_favorite_items_household_name
  on public.favorite_items(household_id, lower(name));

create index idx_favorite_items_household on public.favorite_items(household_id);

create trigger trg_favorite_items_updated_at
before update on public.favorite_items
for each row execute function public.set_updated_at();

alter table public.favorite_items enable row level security;

create policy "members select favorites"
  on public.favorite_items for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "members insert favorites"
  on public.favorite_items for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy "members update favorites"
  on public.favorite_items for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members delete favorites"
  on public.favorite_items for delete
  to authenticated
  using (public.is_household_member(household_id));
