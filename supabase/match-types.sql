-- =====================================================================
-- Monolith 40k – game types and editing rights (Nov 2026)
--  * type: 'Practice' | 'Tournament' (singles) | 'Team Tournament'
--    Practice and Team Tournament are scored 20-0 … 0-20,
--    singles: more points wins, equal points = draw.
--  * Members (Team role) and above may add, edit and delete every game.
--  * The public site only gets team totals per tournament – no player names.
-- =====================================================================

alter table public.matches drop constraint if exists matches_type_check;
update public.matches set type = 'Practice' where type not in ('Practice', 'Tournament', 'Team Tournament');
alter table public.matches add constraint matches_type_check check (type in ('Practice', 'Tournament', 'Team Tournament'));

drop policy if exists matches_insert on public.matches;
create policy matches_insert on public.matches for insert to authenticated with check (public.has_role('team'));
drop policy if exists matches_update on public.matches;
create policy matches_update on public.matches for update to authenticated using (public.has_role('team')) with check (public.has_role('team'));
drop policy if exists matches_delete on public.matches;
create policy matches_delete on public.matches for delete to authenticated using (public.has_role('team'));

drop function if exists public.public_results();
create or replace function public.public_results()
returns table (tournament text, type text, date_from date, date_to date, games int, wins int, draws int, losses int)
language sql stable security definer set search_path = public as $$
  with g as (
    select m.tournament, m.type, m.played_on,
      case when m.type = 'Team Tournament' then
             case when abs(m.our_score - m.opp_score) <= 5 then 'd' when m.our_score > m.opp_score then 'w' else 'l' end
           else case when m.our_score = m.opp_score then 'd' when m.our_score > m.opp_score then 'w' else 'l' end end as r
    from public.matches m
    where m.type in ('Tournament', 'Team Tournament') and m.our_score is not null and m.opp_score is not null
  )
  select coalesce(tournament, '—'), type, min(played_on), max(played_on), count(*)::int,
         count(*) filter (where r = 'w')::int, count(*) filter (where r = 'd')::int, count(*) filter (where r = 'l')::int
  from g group by 1, 2 order by max(played_on) desc, 1
$$;
revoke all on function public.public_results() from public;
grant execute on function public.public_results() to anon, authenticated;
