-- Honorary members (shown in their own section on the team page) + new players Leo, Konrad, Josip
alter table public.players add column if not exists honorary boolean not null default false;
insert into public.players (name, sort, active, honorary)
select v.name, v.sort, true, v.honorary from (values ('Leo', 11, false), ('Konrad', 12, true), ('Josip', 13, true)) as v(name, sort, honorary)
where not exists (select 1 from public.players p where lower(p.name) = lower(v.name));
drop function if exists public.public_players();
create function public.public_players()
 returns table(name text, sort integer, armies text[], photo_url text, fav_army text, bio text, honorary boolean)
 language sql stable security definer set search_path to 'public'
as $$
  select p.name, p.sort,
         coalesce(array(select m.army from public.matches m
                        where m.player_id = p.id and m.type in ('Tournament', 'Team Tournament')
                        group by m.army order by count(*) desc, max(m.played_on) desc), '{}'),
         p.photo_url, p.fav_army, p.bio, p.honorary
  from public.players p
  where p.active
  order by p.sort, p.name
$$;
revoke all on function public.public_players() from public;
grant execute on function public.public_players() to anon, authenticated;
