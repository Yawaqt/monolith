-- =====================================================================
-- Match History for every account (also guests) – separate from team data (Nov 2026)
--  * personal_games: each account sees and edits only its own games.
--  * game_stats(): anonymous totals over everyone's games, for signed-in users only
--    (no names, no single games).
-- =====================================================================
create table if not exists public.personal_games (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  played_on  date not null default current_date,
  army       text not null check (length(army) <= 60),
  opp_army   text not null check (length(opp_army) <= 60),
  my_score   int not null check (my_score between 0 and 200),
  opp_score  int not null check (opp_score between 0 and 200),
  kind       text not null default 'Casual' check (kind in ('Casual', 'Tournament')),
  event      text check (event is null or length(event) <= 80),
  notes      text check (notes is null or length(notes) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists personal_games_user_idx on public.personal_games (user_id, played_on desc);
alter table public.personal_games enable row level security;
drop policy if exists pg_own on public.personal_games;
create policy pg_own on public.personal_games for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.personal_games from anon;
grant select, insert, update, delete on public.personal_games to authenticated;

create or replace function public.game_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'games', (select count(*) from public.personal_games),
    'players', (select count(distinct user_id) from public.personal_games),
    'rows', coalesce((select jsonb_agg(x) from (
      select army, opp_army, count(*)::int as games,
             count(*) filter (where my_score > opp_score)::int as wins,
             count(*) filter (where my_score = opp_score)::int as draws,
             count(*) filter (where my_score < opp_score)::int as losses,
             sum(my_score)::int as pts_for, sum(opp_score)::int as pts_against
      from public.personal_games group by army, opp_army) x), '[]'::jsonb))
$$;
revoke all on function public.game_stats() from public;
grant execute on function public.game_stats() to authenticated;
