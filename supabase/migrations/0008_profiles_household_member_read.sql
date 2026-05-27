-- Migration: allow household members to see each other's profile names
--
-- Grocery rows show who added an item. This policy lets members of the same
-- household read profile rows for display_name/email without opening profiles
-- globally.

create policy "members read household profiles"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_members profile_member
      join public.household_members viewer_member
        on viewer_member.household_id = profile_member.household_id
      where profile_member.user_id = profiles.id
        and viewer_member.user_id = auth.uid()
    )
  );
