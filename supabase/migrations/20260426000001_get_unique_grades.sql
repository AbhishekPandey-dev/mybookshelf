
create or replace function public.get_unique_grades()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select array_agg(distinct grade_level)
  from public.resources
  where grade_level is not null;
$$;
