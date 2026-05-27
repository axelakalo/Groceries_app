alter table public.expiration_reminder_logs
  drop constraint if exists expiration_reminder_logs_delivery_status_check;

alter table public.expiration_reminder_logs
  add constraint expiration_reminder_logs_delivery_status_check
  check (delivery_status in ('sent', 'failed', 'skipped', 'logged'));
