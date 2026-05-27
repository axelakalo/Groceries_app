-- Migration: store owner-visible 6 digit household invite codes
--
-- The secure token hash remains the authoritative lookup value. This nullable
-- code is shown only to household owners through existing invite RLS so they
-- can tell pending members the short code again.

alter table public.household_invites
  add column invite_code text;

alter table public.household_invites
  add constraint household_invites_invite_code_format
  check (invite_code is null or invite_code ~ '^[0-9]{6}$');

-- Existing pending invites created before this migration only have an
-- unrecoverable hash. Give them a new 6 digit code and replace the hash so the
-- code shown in the owner UI can be used to join.
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

create unique index idx_invites_invite_code
  on public.household_invites(invite_code)
  where invite_code is not null;

alter table public.household_invites
  add constraint household_invites_pending_code_required
  check (used_at is not null or invite_code is not null);

create policy "owners delete invites"
  on public.household_invites for delete
  to authenticated
  using (public.is_household_owner(household_id));
