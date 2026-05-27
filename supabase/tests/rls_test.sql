-- =============================================================================
-- PantrySync — RLS Test Plan
-- File: supabase/tests/rls_test.sql
--
-- HOW TO RUN:
-- 1. Apply both migrations (0001, 0002) to a fresh Supabase project.
-- 2. Create two test users via Auth:
--      User A: test-a@example.com
--      User B: test-b@example.com
-- 3. Replace the UUIDs below with the actual auth.users IDs.
-- 4. Run the SETUP section as the service role (e.g., via Supabase SQL Editor
--    with the service_role key, or supabase db reset with seed.sql).
-- 5. Run the TEST sections impersonating each user.
--    In the Supabase SQL Editor you can switch roles:
--      set role authenticated;
--      set request.jwt.claims = '{"sub": "<USER_A_ID>"}';
--    Or use the Supabase client with each user's JWT.
-- 6. Every test labeled SHOULD FAIL should return 0 rows or raise a policy
--    violation error. Tests labeled SHOULD SUCCEED should return rows.
-- =============================================================================

-- ========================
-- SETUP (run as service_role)
-- ========================

-- Replace these with your actual auth.users UUIDs after creating test accounts
-- DO NOT use these placeholder values directly.
\set user_a_id '''00000000-0000-0000-0000-000000000001'''
\set user_b_id '''00000000-0000-0000-0000-000000000002'''

-- Create profiles
insert into public.profiles (id, display_name, email) values
  (:user_a_id::uuid, 'User A', 'test-a@example.com'),
  (:user_b_id::uuid, 'User B', 'test-b@example.com');

-- Create two separate households
insert into public.households (id, name, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Household A', :user_a_id::uuid),
  ('22222222-2222-2222-2222-222222222222', 'Household B', :user_b_id::uuid);

-- Add each user as owner of their own household
insert into public.household_members (household_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', :user_a_id::uuid, 'owner'),
  ('22222222-2222-2222-2222-222222222222', :user_b_id::uuid, 'owner');

-- Create default grocery lists
insert into public.grocery_lists (id, household_id, name, is_default, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Main List', true, :user_a_id::uuid),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Main List', true, :user_b_id::uuid);

-- Create grocery items
insert into public.grocery_items (household_id, list_id, name, added_by) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Milk', :user_a_id::uuid),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Eggs', :user_b_id::uuid);

-- Create pantry items
insert into public.pantry_items (household_id, custom_name, added_by, expiration_date) values
  ('11111111-1111-1111-1111-111111111111', 'Bread', :user_a_id::uuid, current_date + interval '5 days'),
  ('22222222-2222-2222-2222-222222222222', 'Cheese', :user_b_id::uuid, current_date + interval '10 days');

-- Create notification preferences
insert into public.notification_preferences (household_id, user_id) values
  ('11111111-1111-1111-1111-111111111111', :user_a_id::uuid),
  ('22222222-2222-2222-2222-222222222222', :user_b_id::uuid);

-- Create an invite in Household A
insert into public.household_invites (household_id, token_hash, created_by, expires_at) values
  ('11111111-1111-1111-1111-111111111111', 'fakehash_for_testing_only', :user_a_id::uuid, now() + interval '7 days');

-- Create a product (global, readable by all authenticated)
insert into public.products (barcode, name, source) values
  ('5449000000996', 'Coca-Cola', 'open_food_facts');


-- ========================
-- TESTS AS USER A
-- ========================
-- Run these with: set role authenticated; set request.jwt.claims = '{"sub": "<USER_A_ID>"}';

-- TEST 1: User A reads own profile — SHOULD SUCCEED (1 row)
-- select * from public.profiles where id = :user_a_id::uuid;

-- TEST 2: User A reads User B's profile — SHOULD FAIL (0 rows)
-- select * from public.profiles where id = :user_b_id::uuid;

-- TEST 3: User A reads own household — SHOULD SUCCEED (1 row)
-- select * from public.households;

-- TEST 4: User A reads Household B — SHOULD FAIL (0 rows for household_id = 222...)
-- select * from public.households where id = '22222222-2222-2222-2222-222222222222';

-- TEST 5: User A reads own household members — SHOULD SUCCEED
-- select * from public.household_members;

-- TEST 6: User A reads Household B members — SHOULD FAIL (0 rows)
-- select * from public.household_members where household_id = '22222222-2222-2222-2222-222222222222';

-- TEST 7: User A reads own grocery items — SHOULD SUCCEED (sees "Milk")
-- select * from public.grocery_items;

-- TEST 8: User A reads Household B grocery items — SHOULD FAIL (0 rows)
-- select * from public.grocery_items where household_id = '22222222-2222-2222-2222-222222222222';

-- TEST 9: User A inserts grocery item into Household B — SHOULD FAIL (policy violation)
-- insert into public.grocery_items (household_id, list_id, name, added_by)
-- values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Hack', :user_a_id::uuid);

-- TEST 10: User A updates Household B pantry item — SHOULD FAIL (0 rows affected)
-- update public.pantry_items set custom_name = 'Hacked' where household_id = '22222222-2222-2222-2222-222222222222';

-- TEST 11: User A reads Household B pantry items — SHOULD FAIL (0 rows)
-- select * from public.pantry_items where household_id = '22222222-2222-2222-2222-222222222222';

-- TEST 12: User A reads own invites (is owner) — SHOULD SUCCEED
-- select * from public.household_invites;

-- TEST 13: User A reads Household B invites — SHOULD FAIL (0 rows)
-- select * from public.household_invites where household_id = '22222222-2222-2222-2222-222222222222';

-- TEST 14: User A reads products — SHOULD SUCCEED (global read)
-- select * from public.products;

-- TEST 15: User A inserts into products — SHOULD FAIL (no insert policy)
-- insert into public.products (barcode, name, source) values ('1234567890123', 'Fake', 'manual');

-- TEST 16: User A reads own notification prefs — SHOULD SUCCEED
-- select * from public.notification_preferences;

-- TEST 17: User A reads User B's prefs — SHOULD FAIL (0 rows)
-- select * from public.notification_preferences where user_id = :user_b_id::uuid;

-- TEST 18: User A reads own reminder logs — SHOULD SUCCEED (0 rows, none exist yet)
-- select * from public.expiration_reminder_logs;


-- ========================
-- TESTS AS ANONYMOUS (no JWT)
-- ========================
-- Run these with: set role anon;

-- TEST 19: Anonymous reads profiles — SHOULD FAIL (0 rows, policies require authenticated)
-- select * from public.profiles;

-- TEST 20: Anonymous reads households — SHOULD FAIL
-- select * from public.households;

-- TEST 21: Anonymous reads grocery items — SHOULD FAIL
-- select * from public.grocery_items;

-- TEST 22: Anonymous reads pantry items — SHOULD FAIL
-- select * from public.pantry_items;

-- TEST 23: Anonymous reads products — SHOULD FAIL (policy says "to authenticated")
-- select * from public.products;


-- ========================
-- RECURSION CHECK
-- ========================
-- TEST 24: Verify household_members policy does not recurse
-- If this returns without "stack depth exceeded", the SECURITY DEFINER approach works.
-- select * from public.household_members;


-- ========================
-- CLEANUP (run as service_role)
-- ========================
-- delete from public.expiration_reminder_logs;
-- delete from public.notification_preferences;
-- delete from public.household_invites;
-- delete from public.pantry_items;
-- delete from public.grocery_items;
-- delete from public.grocery_lists;
-- delete from public.household_members;
-- delete from public.households;
-- delete from public.profiles;
-- delete from public.products;
