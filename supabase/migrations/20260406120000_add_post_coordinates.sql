alter table public.posts
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

drop index if exists idx_posts_active_grid_cell_path;

alter table public.posts
  drop column if exists grid_cell_path;

create index if not exists idx_posts_active_created_at_with_coordinates
  on public.posts (created_at desc)
  where status = 'active' and latitude is not null and longitude is not null;
