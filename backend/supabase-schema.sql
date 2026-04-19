-- Create this table in Supabase SQL editor.
-- Keep RLS disabled for this table if your backend uses service role only.

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  file_name text not null unique,
  original_name text not null,
  size_bytes integer not null,
  csv_content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_updated_at_idx
  on public.sessions (updated_at desc);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sessions_updated_at on public.sessions;
create trigger set_sessions_updated_at
before update on public.sessions
for each row
execute procedure public.update_updated_at_column();
