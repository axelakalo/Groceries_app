create table public.household_product_overrides (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  custom_name text,
  default_category text,
  default_storage_location text check (
    default_storage_location is null
    or default_storage_location in ('pantry', 'fridge', 'freezer', 'other')
  ),
  default_unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, product_id)
);

create index idx_product_overrides_household
  on public.household_product_overrides(household_id);

create trigger trg_product_overrides_updated_at
before update on public.household_product_overrides
for each row execute function public.set_updated_at();

alter table public.household_product_overrides enable row level security;

create policy "members select overrides"
  on public.household_product_overrides for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "members insert overrides"
  on public.household_product_overrides for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy "members update overrides"
  on public.household_product_overrides for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members delete overrides"
  on public.household_product_overrides for delete
  to authenticated
  using (public.is_household_member(household_id));
