-- Enable the pgvector extension
create extension if not exists vector;

-- Create resource_chunks table
create table if not exists resource_chunks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references resources(id) on delete cascade not null,
  page_number integer not null,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Create an ivfflat index on the embedding column
create index if not exists resource_chunks_embedding_idx 
on resource_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Enable RLS
alter table resource_chunks enable row level security;

-- Function for similarity search
create or replace function match_resource_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_resource_id uuid
)
returns table (
  id uuid,
  resource_id uuid,
  page_number integer,
  content text,
  similarity float
)
language sql
as $$
  select
    resource_chunks.id,
    resource_chunks.resource_id,
    resource_chunks.page_number,
    resource_chunks.content,
    1 - (resource_chunks.embedding <=> query_embedding) as similarity
  from resource_chunks
  where resource_chunks.resource_id = p_resource_id
    and 1 - (resource_chunks.embedding <=> query_embedding) > match_threshold
  order by resource_chunks.embedding <=> query_embedding
  limit match_count;
$$;
