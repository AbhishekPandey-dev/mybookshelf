-- Add full-text search column to resources
alter table resources
add column if not exists fts tsvector
generated always as (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
) stored;

-- GIN index for fast full-text search
create index if not exists resources_fts_idx on resources using gin(fts);
