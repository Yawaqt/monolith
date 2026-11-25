-- =====================================================================
-- Admin protection (Nov 2026)
--  * Owners = the accounts linked to the players listed in public.owners (Miki and David).
--  * Only owners give or take the admin role; an admin may also give up their own admin role.
--  * Admin accounts cannot be deleted – remove the admin role first.
--  * Only owners may link an account to an owner player (nobody can make themselves an owner).
-- Change the owner list only in the SQL editor:  insert into public.owners values (<player id>);
-- =====================================================================
create table if not exists public.owners (player_id bigint primary key references public.players on delete cascade);
alter table public.owners enable row level security;
revoke all on public.owners from anon, authenticated;
insert into public.owners (player_id) select id from public.players where name in ('Miki', 'David') on conflict do nothing;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('admin') and exists (select 1 from public.owners o where o.player_id = public.my_player())
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner_players bigint[] := array(select player_id from public.owners);
begin
  if auth.uid() is null then return new; end if;  -- SQL editor
  -- admin role: only owners, or giving up your own admin role
  if (old.role = 'admin') <> (new.role = 'admin')
     and not public.is_owner()
     and not (new.id = auth.uid() and old.role = 'admin' and new.role <> 'admin') then
    raise exception 'Only Miki or David can give or take the admin role';
  end if;
  -- linking to an owner player only by owners
  if new.player_id is distinct from old.player_id
     and (new.player_id = any(owner_players) or old.player_id = any(owner_players)) and not public.is_owner() then
    raise exception 'Only Miki or David can change this player link';
  end if;
  -- everything else about roles, links and reviews: admins
  if not public.has_role('admin') and not (new.id = auth.uid() and old.role = 'admin')
     and (new.role is distinct from old.role or new.player_id is distinct from old.player_id or new.reviewed_at is distinct from old.reviewed_at) then
    raise exception 'Only admins can change roles, player links or review sign-ups';
  end if;
  return new;
end $$;

create or replace function public.protect_profile_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.role = 'admin' then raise exception 'Admins cannot be deleted – remove the admin role first'; end if;
  return old;
end $$;
drop trigger if exists protect_profile_delete on public.profiles;
create trigger protect_profile_delete before delete on public.profiles for each row execute function public.protect_profile_delete();

create or replace function public.admin_delete_user(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'Only admins can delete accounts'; end if;
  if p_id = auth.uid() then raise exception 'You cannot delete your own account here'; end if;
  if exists (select 1 from public.profiles where id = p_id and role = 'admin') then
    raise exception 'Admins cannot be deleted – remove the admin role first';
  end if;
  delete from auth.users where id = p_id;
end $$;

create or replace function public.owner_players() returns bigint[]
language sql stable security definer set search_path = public as $$ select array(select player_id from public.owners) $$;
revoke all on function public.owner_players() from public;
grant execute on function public.owner_players() to authenticated;
