-- Migration: create_household_with_defaults RPC
-- Phase 5: Household Onboarding
--
-- This function atomically creates:
--   1. A household
--   2. The creator as 'owner' in household_members
--   3. A default grocery list (is_default = true)
--   4. Notification preferences with default values
--
-- Called from the frontend via supabase.rpc('create_household_with_defaults', { household_name: '...' })
-- Returns the new household UUID on success.

create or replace function public.create_household_with_defaults(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
  current_user_id  uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if household_name is null or trim(household_name) = '' then
    raise exception 'Household name cannot be blank';
  end if;

  -- 1. Create the household
  insert into public.households (name, created_by)
  values (trim(household_name), current_user_id)
  returning id into new_household_id;

  -- 2. Add the creator as owner
  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, current_user_id, 'owner');

  -- 3. Create the default grocery list
  insert into public.grocery_lists (household_id, name, is_default, created_by)
  values (new_household_id, 'Main List', true, current_user_id);

  -- 4. Create default notification preferences for this user
  insert into public.notification_preferences (household_id, user_id)
  values (new_household_id, current_user_id);

  return new_household_id;
end;
$$;

-- Revoke from public (default), grant only to authenticated users
revoke all on function public.create_household_with_defaults(text) from public;
grant execute on function public.create_household_with_defaults(text) to authenticated;
