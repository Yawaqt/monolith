-- Admins delete a sign-in account (login + profile). Players and their games are not touched.
-- (Applied to the live database on 25 Nov 2026.)
create or replace function public.admin_delete_user(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'Only admins can delete accounts'; end if;
  if p_id = auth.uid() then raise exception 'You cannot delete your own account here'; end if;
  delete from auth.users where id = p_id;
end $$;
revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
