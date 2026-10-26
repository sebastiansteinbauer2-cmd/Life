// SQL pro připomínky (Supabase → SQL Editor → Run). Stejné SQL je v repozitáři: supabase/push.sql.
// Na tabletu se SQL vkládá po menších částech, proto jsou dvě.

export const PUSH_SQL_1 = `create or replace function public.questy_push_tick(only_user uuid default null, test boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record; lt timestamp; today date; h int; d date; n int; kind text; title text; body text; sent int := 0;
begin
  for r in
    select p.user_id, p.id as endpoint, p.data as s, k.data as keys
    from public.questy_records p
    join public.questy_records k on k.user_id = p.user_id and k.col = 'pushKeys' and k.id = 'vapid' and not k.deleted
    where p.col = 'push' and not p.deleted and (only_user is null or p.user_id = only_user)
  loop
    lt := now() at time zone coalesce(r.s->>'tz', 'Europe/Prague');
    today := lt::date;
    h := extract(hour from lt);
    kind := null;
    if test then
      kind := 'test';
    elsif (r.s->>'evening') is not null and h >= (r.s->>'evening')::int and h < (r.s->>'evening')::int + 3
      and not exists (select 1 from public.questy_records x where x.user_id = r.user_id and x.col = 'xpLog' and not x.deleted
        and x.data->>'date' = to_char(today, 'YYYY-MM-DD') and (x.data->>'amount')::numeric > 0) then
      kind := 'evening';
    elsif (r.s->>'morning') is not null and h >= (r.s->>'morning')::int and h < (r.s->>'morning')::int + 3 then
      kind := 'morning';
    end if;
    continue when kind is null;
    continue when kind <> 'test' and exists (select 1 from public.questy_records x where x.user_id = r.user_id and x.col = 'pushSent'
      and x.id = md5(r.endpoint) || ':' || kind and x.data->>'date' = to_char(today, 'YYYY-MM-DD'));
    -- série dní v řadě (dnes, nebo do včerejška)
    n := 0;
    d := today;
    if not exists (select 1 from public.questy_records x where x.user_id = r.user_id and x.col = 'xpLog' and not x.deleted
      and x.data->>'date' = to_char(d, 'YYYY-MM-DD') and (x.data->>'amount')::numeric > 0) then d := today - 1; end if;
    while n < 3650 and exists (select 1 from public.questy_records x where x.user_id = r.user_id and x.col = 'xpLog' and not x.deleted
      and x.data->>'date' = to_char(d, 'YYYY-MM-DD') and (x.data->>'amount')::numeric > 0) loop
      n := n + 1;
      d := d - 1;
    end loop;
    if kind = 'test' then
      title := '✅ Notifikace fungují';
      body := 'Takhle ti budou chodit připomínky.';
    elsif kind = 'evening' and n > 0 then
      title := '🔥 Série ' || n || ' dní je v ohrožení!';
      body := 'Dnes ještě nemáš žádný quest. Stačí jeden a série pokračuje.';
    elsif kind = 'evening' then
      title := '⚔️ Dnešní quest čeká';
      body := 'Splň dnes aspoň jeden quest a začni novou sérii.';
    else
      title := '☀️ Dobré ráno, ' || coalesce(nullif(r.s->>'name', ''), 'hrdino') || '!';
      body := case when n > 0 then 'Série ' || n || ' dní 🔥 Dnešní questy čekají.' else 'Nový den, nové questy. Pojď na to!' end;
    end if;
    perform net.http_post(
      url := (r.s->>'relay') || '/api/push',
      body := jsonb_build_object('subscription', r.s->'subscription', 'vapid', r.keys,
        'payload', jsonb_build_object('title', title, 'body', body, 'tag', kind, 'url', './#/'))
    );
    if kind <> 'test' then
      insert into public.questy_records (user_id, col, id, data, client_ts)
      values (r.user_id, 'pushSent', md5(r.endpoint) || ':' || kind,
        jsonb_build_object('date', to_char(today, 'YYYY-MM-DD')), (extract(epoch from now()) * 1000)::bigint)
      on conflict (user_id, col, id) do update set data = excluded.data, client_ts = excluded.client_ts;
    end if;
    sent := sent + 1;
  end loop;
  return sent;
end $$;
`;

export const PUSH_SQL_2 = `create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
revoke execute on function public.questy_push_tick(uuid, boolean) from public, anon, authenticated;
create or replace function public.questy_push_test() returns integer
language sql security definer set search_path = '' as $$
  select public.questy_push_tick(auth.uid(), true)
$$;
revoke execute on function public.questy_push_test() from public, anon;
grant execute on function public.questy_push_test() to authenticated;
select cron.schedule('questy-push', '*/10 * * * *', 'select public.questy_push_tick()');
`;
