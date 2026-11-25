-- BCP profile link per player (already applied to the live database on 25 Nov 2026)
alter table public.players add column if not exists bcp_url text check (bcp_url is null or bcp_url ~* '^https://([a-z0-9-]+\.)*bestcoastpairings\.com/');

drop function if exists public.public_players();
create function public.public_players()
returns table (name text, sort int, armies text[], bcp_url text)
language sql stable security definer set search_path = public as $$
  select p.name, p.sort,
         coalesce(array(select a->>'army' from jsonb_array_elements(p.armies) a where coalesce(a->>'army', '') <> ''), '{}'),
         p.bcp_url
  from public.players p
  where p.active
  order by p.sort, p.name
$$;
revoke all on function public.public_players() from public;
grant execute on function public.public_players() to anon, authenticated;
