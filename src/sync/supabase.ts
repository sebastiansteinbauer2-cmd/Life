import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemoteRow } from '../data/store';
import type { SyncRemote } from './engine';

export const TABLE = 'questy_records';

/** SQL pro Supabase (SQL Editor → Run). Stejný soubor je v repozitáři: supabase/schema.sql. */
export const SCHEMA_SQL = `create table if not exists public.questy_records (
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
`;

let clientPromise: { key: string; client: Promise<SupabaseClient> } | null = null;

/** Klient Supabase – knihovna se načte až když je potřeba. */
export function supabaseClient(url: string, key: string): Promise<SupabaseClient> {
  const id = `${url}|${key}`;
  if (clientPromise?.key !== id) {
    clientPromise = {
      key: id,
      client: import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'questy.sb' } })),
    };
  }
  return clientPromise.client;
}

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export function supabaseRemote(client: SupabaseClient, userId: string): SyncRemote {
  return {
    async push(rows) {
      if (!rows.length) return;
      const { error } = await client.from(TABLE).upsert(
        rows.map((r) => ({ user_id: userId, col: r.col, id: r.id, data: r.data, deleted: r.deleted, client_ts: r.client_ts })),
        { onConflict: 'user_id,col,id' },
      );
      fail(error);
    },
    async pull(since, offset, limit) {
      let q = client.from(TABLE).select('col,id,data,deleted,client_ts,updated_at');
      if (since) q = q.gt('updated_at', since);
      const { data, error } = await q.order('updated_at').order('col').order('id').range(offset, offset + limit - 1);
      fail(error);
      return ((data ?? []) as RemoteRow[]).map((r) => ({ ...r, client_ts: Number(r.client_ts) }));
    },
    async keys() {
      const out: Awaited<ReturnType<SyncRemote['keys']>> = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.from(TABLE).select('col,id,deleted').order('col').order('id').range(offset, offset + 999);
        fail(error);
        out.push(...((data ?? []) as typeof out));
        if (!data || data.length < 1000) return out;
      }
    },
  };
}
