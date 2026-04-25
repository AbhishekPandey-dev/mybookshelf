-- Create resource_views table for tracking analytics
create table if not exists resource_views (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references resources(id) on delete cascade,
  viewed_at timestamptz default now()
);

-- Index for faster analytics queries
create index if not exists resource_views_resource_id_idx on resource_views(resource_id);
create index if not exists resource_views_viewed_at_idx on resource_views(viewed_at);
