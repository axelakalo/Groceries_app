create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'grocery_item_added', 'grocery_item_checked', 'grocery_item_unchecked',
    'grocery_item_deleted', 'pantry_item_added', 'pantry_item_used',
    'pantry_item_discarded', 'pantry_item_restored',
    'pantry_item_added_to_grocery', 'household_member_joined',
    'household_member_left'
  )),
  entity_type text not null check (entity_type in ('grocery_item', 'pantry_item', 'household_member')),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_activity_events_household on public.activity_events(household_id);
create index idx_activity_events_created on public.activity_events(household_id, created_at desc);

alter table public.activity_events enable row level security;

create policy "members select activity"
  on public.activity_events for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "members insert activity"
  on public.activity_events for insert
  to authenticated
  with check (public.is_household_member(household_id) and actor_id = auth.uid());
