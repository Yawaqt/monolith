-- Events: date range (von–bis) instead of a start time, kind = 'Singles' | 'Team Tournament',
-- team size only for team tournaments. (Applied to the live database on 25 Nov 2026.)
alter table public.events add column if not exists ends_on date;
update public.events set ends_on = starts_on where ends_on is null;
alter table public.events drop constraint if exists events_ends_after_start;
alter table public.events add constraint events_ends_after_start check (ends_on is null or ends_on >= starts_on);
update public.events set kind = case when title ~* '\mteams?\M' then 'Team Tournament' else 'Singles' end
where kind is null or kind not in ('Singles', 'Team Tournament');
alter table public.events alter column kind set default 'Singles';
alter table public.events drop constraint if exists events_kind_check;
alter table public.events add constraint events_kind_check check (kind in ('Singles', 'Team Tournament'));
alter table public.events alter column team_size drop not null;
update public.events set team_size = null where kind = 'Singles';

drop function if exists public.public_events();
create function public.public_events()
returns table (starts_on date, ends_on date, title text, location text, kind text, team_size int)
language sql stable security definer set search_path = public as $$
  select e.starts_on, coalesce(e.ends_on, e.starts_on), e.title, e.location, e.kind, e.team_size
  from public.events e
  where coalesce(e.ends_on, e.starts_on) >= current_date
  order by e.starts_on
$$;
revoke all on function public.public_events() from public;
grant execute on function public.public_events() to anon, authenticated;

-- 26 Nov 2026: BCP event link
alter table public.events add column if not exists bcp_url text check (bcp_url is null or bcp_url ~* '^https://([a-z0-9-]+\.)*bestcoastpairings\.com/');
drop function if exists public.public_events();
create function public.public_events()
returns table (starts_on date, ends_on date, title text, location text, kind text, team_size int, bcp_url text)
language sql stable security definer set search_path = public as $$
  select e.starts_on, coalesce(e.ends_on, e.starts_on), e.title, e.location, e.kind, e.team_size, e.bcp_url
  from public.events e
  where coalesce(e.ends_on, e.starts_on) >= current_date
  order by e.starts_on
$$;
revoke all on function public.public_events() from public;
grant execute on function public.public_events() to anon, authenticated;
