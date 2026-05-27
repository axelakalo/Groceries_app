update public.discord_integrations
set
  mention_enabled = true,
  mention_role_id = coalesce(mention_role_id, '1509203591334858804')
where mention_role_id is null
   or mention_role_id = '';
