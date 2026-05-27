-- Migration: repair pending invite codes and ensure owner delete policy
--
-- This is safe to run after 0005 even if 0005 already created the policy.

with generated_codes as (
  select
    id,
    lpad(floor(random() * 1000000)::int::text, 6, '0') as code
  from public.household_invites
  where invite_code is null
    and used_at is null
)
update public.household_invites invites
set
  invite_code = generated_codes.code,
  token_hash = encode(extensions.digest(generated_codes.code, 'sha256'), 'hex')
from generated_codes
where invites.id = generated_codes.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'household_invites_pending_code_required'
  ) then
    alter table public.household_invites
      add constraint household_invites_pending_code_required
      check (used_at is not null or invite_code is not null);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'household_invites'
      and policyname = 'owners delete invites'
  ) then
    create policy "owners delete invites"
      on public.household_invites for delete
      to authenticated
      using (public.is_household_owner(household_id));
  end if;
end $$;
