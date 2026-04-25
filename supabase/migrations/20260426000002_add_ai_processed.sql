
-- Add ai_processed column to resources
alter table public.resources add column if not exists ai_processed boolean not null default false;

-- Update existing resources to true if they have chunks (optional but good)
update public.resources 
set ai_processed = true 
where id in (select distinct resource_id from public.resource_chunks);
