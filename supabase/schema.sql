-- Questy života – tabulka pro synchronizaci (Supabase → SQL Editor → Run)
-- Stejné SQL je v aplikaci: src/sync/supabase.ts
create table if not exists public.questy_records (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  col text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  client_ts bigint not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, col, id)
);
create index if not exists questy_records_pull on public.questy_records (user_id, updated_at);

alter table public.questy_records enable row level security;
drop policy if exists "vlastni zaznamy" on public.questy_records;
create policy "vlastni zaznamy" on public.questy_records for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.questy_records to authenticated;

-- novější změna vyhrává; čas zápisu určuje server
create or replace function public.questy_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.client_ts < old.client_ts then
    return null;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists questy_touch on public.questy_records;
create trigger questy_touch before insert or update on public.questy_records
  for each row execute function public.questy_touch();
