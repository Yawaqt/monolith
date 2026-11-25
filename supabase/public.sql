-- =====================================================================
-- Monolith 40k – what visitors WITHOUT an account may see.
-- Read-only functions that return a safe subset: no notes, no opponent
-- names, no dispositions, no RSVPs, no money.
-- =====================================================================

create or replace function public.public_players()
returns table (name text, sort int, armies text[])
language sql stable security definer set search_path = public as $$
  select p.name, p.sort,
         coalesce(array(select a->>'army' from jsonb_array_elements(p.armies) a where coalesce(a->>'army', '') <> ''), '{}')
  from public.players p
  where p.active
  order by p.sort, p.name
$$;

create or replace function public.public_results()
returns table (played_on date, tournament text, player text, army text, opp_faction text, our_score int, opp_score int)
language sql stable security definer set search_path = public as $$
  select m.played_on, m.tournament, p.name, m.army, m.opp_faction, m.our_score, m.opp_score
  from public.matches m join public.players p on p.id = m.player_id
  where m.type = 'Tournament' and m.our_score is not null and m.opp_score is not null
  order by m.played_on desc, m.id desc
$$;

create or replace function public.public_events()
returns table (starts_on date, start_time text, title text, location text, kind text)
language sql stable security definer set search_path = public as $$
  select e.starts_on, e.start_time, e.title, e.location, e.kind
  from public.events e
  where e.starts_on >= current_date
  order by e.starts_on
$$;

revoke all on function public.public_players(), public.public_results(), public.public_events() from public;
grant execute on function public.public_players(), public.public_results(), public.public_events() to anon, authenticated;
