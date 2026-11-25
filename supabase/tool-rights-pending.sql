-- =====================================================================
-- Tournament tool rights + pending sign-ups for admins (Nov 2026)
--  * Every member (Team role) can open every team event (read only).
--  * Players in the event's line-up edit it (matrix, opponent teams, rounds, notes);
--    captains and admins edit everything. Only captains change the line-up, title, size, rules, sharing.
--  * profiles.reviewed_at: an admin has looked at a new sign-up (so it is no longer "waiting").
-- =====================================================================
create or replace function public.tevent_member(p_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('captain') or (public.has_role('team') and exists (
    select 1 from public.tevents e, jsonb_array_elements(e.lineup) l
    where e.id = p_id and nullif(l->>'player_id', '')::bigint = public.my_player()))
$$;
revoke all on function public.tevent_member(bigint) from public;
grant execute on function public.tevent_member(bigint) to authenticated;

drop policy if exists tevents_update on public.tevents;
create policy tevents_update on public.tevents for update to authenticated using (public.tevent_member(id)) with check (public.tevent_member(id));
drop policy if exists trounds_write on public.tevent_rounds;
create policy trounds_write on public.tevent_rounds for insert to authenticated with check (public.tevent_member(tevent_id));
drop policy if exists trounds_update on public.tevent_rounds;
create policy trounds_update on public.tevent_rounds for update to authenticated using (public.tevent_member(tevent_id)) with check (public.tevent_member(tevent_id));

create or replace function public.protect_tevent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role('captain')
     and (new.share_code is distinct from old.share_code or new.share_pw is distinct from old.share_pw
          or new.rules is distinct from old.rules or new.size is distinct from old.size or new.title is distinct from old.title
          or new.lineup is distinct from old.lineup or new.event_id is distinct from old.event_id) then
    raise exception 'Only captains can change line-up, title, size, rules or sharing';
  end if;
  new.updated_at := now();
  return new;
end $$;

alter table public.profiles add column if not exists reviewed_at timestamptz;
update public.profiles set reviewed_at = now() where role <> 'guest' and reviewed_at is null;
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role('admin')
     and (new.role is distinct from old.role or new.player_id is distinct from old.player_id or new.reviewed_at is distinct from old.reviewed_at) then
    raise exception 'Only admins can change roles, player links or review sign-ups';
  end if;
  return new;
end $$;
