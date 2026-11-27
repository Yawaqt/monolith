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

-- Ehrenmitglied as an assignable account role (same rights as a member); keeps the player's honorary flag in step
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array['guest','team','honorary','captain','admin']));
create or replace function public.role_rank(r text) returns integer language sql immutable as $$
  select case r when 'admin' then 4 when 'captain' then 3 when 'team' then 2 when 'honorary' then 2 when 'guest' then 1 else 0 end
$$;
create or replace function public.sync_honorary() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.player_id is not null and (new.role is distinct from old.role or new.player_id is distinct from old.player_id) then
    if new.role = 'honorary' then update public.players set honorary = true where id = new.player_id;
    elsif old.role = 'honorary' and new.player_id = old.player_id then update public.players set honorary = false where id = new.player_id; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_sync_honorary on public.profiles;
create trigger profiles_sync_honorary after update on public.profiles for each row execute function public.sync_honorary();
