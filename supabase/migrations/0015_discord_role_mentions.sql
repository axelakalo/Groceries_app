alter table public.discord_integrations
  add column if not exists mention_enabled boolean not null default false,
  add column if not exists mention_role_id text;

alter table public.discord_integrations
  drop constraint if exists discord_integrations_mention_role_id_check;

alter table public.discord_integrations
  add constraint discord_integrations_mention_role_id_check
  check (
    mention_role_id is null
    or mention_role_id ~ '^[0-9]{17,20}$'
  );
