-- =============================================================================
-- PantrySync — RLS Policies
-- Migration: 0002_rls_policies.sql
--
-- Every household-scoped table uses is_household_member() / is_household_owner()
-- to avoid recursive RLS on household_members.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "users read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------
create policy "members read their households"
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

create policy "authenticated users create household"
  on public.households for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "owners update household"
  on public.households for update
  to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

create policy "owners delete household"
  on public.households for delete
  to authenticated
  using (public.is_household_owner(id));

-- ---------------------------------------------------------------------------
-- household_members (the tricky one — uses SECURITY DEFINER helpers)
-- ---------------------------------------------------------------------------
create policy "members read membership rows of their households"
  on public.household_members for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "owners insert members"
  on public.household_members for insert
  to authenticated
  with check (
    -- creating self as owner during household creation
    (user_id = auth.uid() and role = 'owner')
    -- or owner adding someone (accept-invite Edge Function uses service role, bypasses this)
    or public.is_household_owner(household_id)
  );

create policy "users remove themselves"
  on public.household_members for delete
  to authenticated
  using (user_id = auth.uid());

create policy "owners remove members"
  on public.household_members for delete
  to authenticated
  using (public.is_household_owner(household_id) and user_id != auth.uid());

-- ---------------------------------------------------------------------------
-- household_invites
-- Only owners can read. Create/update/delete handled by Edge Functions
-- using the service role — no frontend insert/update/delete policies.
-- ---------------------------------------------------------------------------
create policy "owners read invites"
  on public.household_invites for select
  to authenticated
  using (public.is_household_owner(household_id));

-- ---------------------------------------------------------------------------
-- grocery_lists
-- ---------------------------------------------------------------------------
create policy "members select lists"
  on public.grocery_lists for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "members insert lists"
  on public.grocery_lists for insert
  to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());

create policy "members update lists"
  on public.grocery_lists for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members delete lists"
  on public.grocery_lists for delete
  to authenticated
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- grocery_items
-- ---------------------------------------------------------------------------
create policy "members select items"
  on public.grocery_items for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "members insert items"
  on public.grocery_items for insert
  to authenticated
  with check (public.is_household_member(household_id) and added_by = auth.uid());

create policy "members update items"
  on public.grocery_items for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members delete items"
  on public.grocery_items for delete
  to authenticated
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- products
-- Readable by any authenticated user (global product cache).
-- No insert/update/delete for the frontend — the lookup-product Edge Function
-- uses the service role to write.
-- ---------------------------------------------------------------------------
create policy "authenticated users read products"
  on public.products for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- pantry_items
-- ---------------------------------------------------------------------------
create policy "members select pantry"
  on public.pantry_items for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "members insert pantry"
  on public.pantry_items for insert
  to authenticated
  with check (public.is_household_member(household_id) and added_by = auth.uid());

create policy "members update pantry"
  on public.pantry_items for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members delete pantry"
  on public.pantry_items for delete
  to authenticated
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- notification_preferences
-- Users can only see and modify their own preferences, scoped to households
-- they belong to.
-- ---------------------------------------------------------------------------
create policy "users select own prefs"
  on public.notification_preferences for select
  to authenticated
  using (user_id = auth.uid());

create policy "users insert own prefs"
  on public.notification_preferences for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy "users update own prefs"
  on public.notification_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own prefs"
  on public.notification_preferences for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- expiration_reminder_logs
-- Users can read their own logs. Inserts only via the
-- send-expiration-reminders Edge Function (service role).
-- ---------------------------------------------------------------------------
create policy "users read own reminder logs"
  on public.expiration_reminder_logs for select
  to authenticated
  using (user_id = auth.uid());
