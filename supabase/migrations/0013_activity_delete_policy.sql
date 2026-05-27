create policy "members delete activity"
  on public.activity_events for delete
  to authenticated
  using (public.is_household_member(household_id));
