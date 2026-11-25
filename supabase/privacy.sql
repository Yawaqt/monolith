-- Privacy (GDPR): legal contact data for the privacy page and self-service account deletion.
-- (Applied to the live database on 25 Nov 2026.)
alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content add constraint site_content_key_check check (key in ('about', 'group_photos', 'legal'));

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Admins must give up the admin role before deleting their account';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
