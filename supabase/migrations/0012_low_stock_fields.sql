alter table public.pantry_items
  add column track_quantity boolean not null default false;

alter table public.pantry_items
  add column low_stock_threshold numeric
  check (low_stock_threshold is null or low_stock_threshold > 0);
