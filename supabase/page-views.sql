-- Cookieless visitor statistics (admins only).
-- No cookies, no local storage, no IP addresses or names are stored. A visitor is counted once per day via a
-- hash of (IP + browser + a random salt of that day); the salt is deleted after two days, so the hash can no
-- longer be traced back to anyone. Rows are kept for 13 months.
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  path text not null,
  ref text,
  device text,
  visitor text
);
create index if not exists page_views_at on public.page_views (at desc);
alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;

create table if not exists public.page_view_salts (day date primary key, salt text not null);
alter table public.page_view_salts enable row level security;
revoke all on public.page_view_salts from anon, authenticated;

create or replace function public.track_view(p_path text, p_ref text default null, p_device text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare h json := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
        ua text := coalesce(h->>'user-agent', ''); ip text := split_part(coalesce(h->>'cf-connecting-ip', h->>'x-forwarded-for', h->>'x-real-ip', ''), ',', 1);
        s text; v text;
begin
  if ua ~* '(bot|crawl|spider|slurp|preview|headless|lighthouse)' then return; end if;
  if p_path is null or p_path !~ '^[a-z0-9_/-]{1,40}$' then return; end if;
  insert into public.page_view_salts (day, salt) values (current_date, md5(random()::text || clock_timestamp()::text)) on conflict (day) do nothing;
  select salt into s from public.page_view_salts where day = current_date;
  v := left(encode(sha256(convert_to(ip || '|' || ua || '|' || s, 'UTF8')), 'hex'), 16);
  insert into public.page_views (path, ref, device, visitor)
  values (p_path, nullif(left(lower(coalesce(p_ref, '')), 60), ''), case when p_device in ('mobile', 'desktop') then p_device end, v);
  delete from public.page_view_salts where day < current_date - 1;
  if random() < 0.01 then delete from public.page_views where at < now() - interval '13 months'; end if;
end $$;
revoke all on function public.track_view(text, text, text) from public;
grant execute on function public.track_view(text, text, text) to anon, authenticated;

create or replace function public.view_stats(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare d int := greatest(1, least(coalesce(p_days, 30), 400)); since timestamptz := date_trunc('day', now() at time zone 'Europe/Vienna') at time zone 'Europe/Vienna' - make_interval(days => d - 1);
begin
  if not public.has_role('admin') then raise exception 'admins only'; end if;
  return jsonb_build_object(
    'days', d,
    'today', (select jsonb_build_object('views', count(*), 'visitors', count(distinct visitor)) from public.page_views where at >= date_trunc('day', now() at time zone 'Europe/Vienna') at time zone 'Europe/Vienna'),
    'total', (select jsonb_build_object('views', count(*), 'visitors', count(distinct (visitor, (at at time zone 'Europe/Vienna')::date))) from public.page_views where at >= since),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', g.day, 'views', coalesce(x.views, 0), 'visitors', coalesce(x.visitors, 0)) order by g.day)
       from generate_series((since at time zone 'Europe/Vienna')::date, (now() at time zone 'Europe/Vienna')::date, interval '1 day') as g(day)
       left join (select (at at time zone 'Europe/Vienna')::date as day, count(*) views, count(distinct visitor) visitors from public.page_views where at >= since group by 1) x on x.day = g.day::date), '[]'),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'views', n) order by n desc) from (select path, count(*) n from public.page_views where at >= since group by 1 order by 2 desc limit 15) q), '[]'),
    'refs', coalesce((select jsonb_agg(jsonb_build_object('ref', ref, 'views', n) order by n desc) from (select coalesce(ref, '') ref, count(*) n from public.page_views where at >= since and ref is not null group by 1 order by 2 desc limit 10) q), '[]'),
    'devices', coalesce((select jsonb_object_agg(coalesce(device, 'unknown'), n) from (select device, count(*) n from public.page_views where at >= since group by 1) q), '{}')
  );
end $$;
revoke all on function public.view_stats(integer) from public;
grant execute on function public.view_stats(integer) to authenticated;
