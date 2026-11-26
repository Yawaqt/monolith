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

-- 26 Nov 2026: members edit/delete only their own games; admins all
drop policy if exists matches_update on public.matches;
create policy matches_update on public.matches for update to authenticated
  using (public.has_role('admin') or (public.has_role('team') and (created_by = auth.uid() or player_id = public.my_player() or opp_player_id = public.my_player())))
  with check (public.has_role('admin') or (public.has_role('team') and (created_by = auth.uid() or player_id = public.my_player() or opp_player_id = public.my_player())));
drop policy if exists matches_delete on public.matches;
create policy matches_delete on public.matches for delete to authenticated
  using (public.has_role('admin') or (public.has_role('team') and (created_by = auth.uid() or player_id = public.my_player() or opp_player_id = public.my_player())));
create or replace function public.link_internal_game(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare me bigint := public.my_player();
begin
  if not public.has_role('team') or me is null then raise exception 'Not allowed'; end if;
  update public.matches set opp_player_id = me where id = p_id and opp_player_id is null and player_id <> me;
end $$;
revoke all on function public.link_internal_game(bigint) from public;
grant execute on function public.link_internal_game(bigint) to authenticated;

-- public_results: internal games count for both players; number of distinct players per tournament (no names)
drop function if exists public.public_results();
create function public.public_results()
 returns table(tournament text, type text, date_from date, date_to date, games integer, wins integer, draws integer, losses integer, players integer)
 language sql stable security definer set search_path to 'public'
as $$
  with base as (
    select m.tournament, m.type, m.played_on, m.player_id as pid, m.our_score as a, m.opp_score as b
    from public.matches m
    where m.type in ('Tournament','Team Tournament') and m.our_score is not null and m.opp_score is not null
    union all
    select m.tournament, m.type, m.played_on, m.opp_player_id, m.opp_score, m.our_score
    from public.matches m
    where m.opp_player_id is not null and m.type in ('Tournament','Team Tournament') and m.our_score is not null and m.opp_score is not null
  ), g as (
    select tournament, type, played_on, pid,
      case when type = 'Team Tournament' then
             case when abs(a - b) <= 5 then 'd' when a > b then 'w' else 'l' end
           else case when a = b then 'd' when a > b then 'w' else 'l' end end as r
    from base
  )
  select coalesce(tournament, '—'), type, min(played_on), max(played_on), count(*)::int,
         count(*) filter (where r = 'w')::int, count(*) filter (where r = 'd')::int, count(*) filter (where r = 'l')::int,
         count(distinct pid)::int
  from g group by 1, 2 order by max(played_on) desc, 1
$$;
revoke all on function public.public_results() from public;
grant execute on function public.public_results() to anon, authenticated;
