-- "Content": extra switch on top of the role (applied 26 Nov 2026).
-- At least member rights (a guest with Content counts as 'team') and may edit and delete all news.
-- Only admins switch it on or off.
alter table public.profiles add column if not exists content boolean not null default false;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select case when role in ('guest') and content then 'team' else role end from public.profiles where id = auth.uid()), 'anon')
$$;

create or replace function public.is_content() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select content from public.profiles where id = auth.uid()), false)
$$;
revoke all on function public.is_content() from public;
grant execute on function public.is_content() to authenticated;

drop policy if exists news_update on public.news;
create policy news_update on public.news for update to authenticated
  using (public.has_role('captain') or public.is_content() or (public.has_role('team') and author_id = auth.uid()))
  with check (public.has_role('captain') or public.is_content() or (public.has_role('team') and author_id = auth.uid()));
drop policy if exists news_delete on public.news;
create policy news_delete on public.news for delete to authenticated
  using (public.has_role('captain') or public.is_content() or (public.has_role('team') and author_id = auth.uid()));
-- protect_profile(): see owners.sql – additionally "new.content is distinct from old.content" is admin-only.
