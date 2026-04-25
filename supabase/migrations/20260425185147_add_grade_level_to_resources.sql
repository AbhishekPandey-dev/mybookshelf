
-- Add grade_level column to resources
alter table public.resources add column if not exists grade_level text;

-- Update FTS column to include grade_level for searching
alter table public.resources drop column if exists fts;
alter table public.resources add column fts tsvector
generated always as (
  to_tsvector('english', 
    coalesce(title, '') || ' ' || 
    coalesce(description, '') || ' ' || 
    coalesce(grade_level, '')
  )
) stored;

-- Recreate the GIN index
drop index if exists resources_fts_idx;
create index resources_fts_idx on public.resources using gin(fts);
