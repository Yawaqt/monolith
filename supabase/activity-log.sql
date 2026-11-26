-- Admin-only activity log: who did what (only bigger actions).
-- Written by triggers (security definer); clients can only read, and only admins.
-- Repeated actions by the same person within 15 minutes are merged (n = count),
-- e.g. a tournament import of 5 games becomes one line "5 games logged".
create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_name text,
  action text not null,
  label text,
  n integer not null default 1
);
create index if not exists activity_log_at on public.activity_log (at desc);
alter table public.activity_log enable row level security;
drop policy if exists activity_log_read on public.activity_log;
create policy activity_log_read on public.activity_log for select using (public.has_role('admin'));
revoke insert, update, delete on public.activity_log from anon, authenticated;

create or replace function public.log_activity(p_action text, p_label text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); nm text; last_id bigint;
begin
  if uid is null then return; end if; -- skip server-side / maintenance changes
  select display_name into nm from public.profiles where id = uid;
  select id into last_id from public.activity_log
   where actor = uid and action = p_action and coalesce(label, '') = coalesce(p_label, '') and at > now() - interval '15 minutes'
   order by at desc limit 1;
  if last_id is not null then
    update public.activity_log set n = n + 1, at = now() where id = last_id;
  else
    insert into public.activity_log (actor, actor_name, action, label) values (uid, coalesce(nm, '?'), p_action, p_label);
  end if;
  delete from public.activity_log where at < now() - interval '365 days';
end $$;
revoke all on function public.log_activity(text, text) from public, anon, authenticated;

create or replace function public.trg_activity() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if TG_TABLE_NAME = 'matches' then
    if TG_OP = 'INSERT' then perform public.log_activity('match_add', coalesce(new.tournament, new.type));
    elsif TG_OP = 'DELETE' then perform public.log_activity('match_del', coalesce(old.tournament, old.type)); end if;
  elsif TG_TABLE_NAME = 'news' then
    if TG_OP = 'INSERT' then perform public.log_activity(case when new.published then 'news_pub' else 'news_add' end, new.title);
    elsif TG_OP = 'UPDATE' and new.published and not coalesce(old.published, false) then perform public.log_activity('news_pub', new.title);
    elsif TG_OP = 'DELETE' then perform public.log_activity('news_del', old.title); end if;
  elsif TG_TABLE_NAME = 'events' then
    if TG_OP = 'INSERT' then perform public.log_activity('event_add', new.title);
    elsif TG_OP = 'DELETE' then perform public.log_activity('event_del', old.title); end if;
  elsif TG_TABLE_NAME = 'tevents' then
    if TG_OP = 'INSERT' then perform public.log_activity('tevent_add', new.title);
    elsif TG_OP = 'DELETE' then perform public.log_activity('tevent_del', old.title); end if;
  elsif TG_TABLE_NAME = 'players' then
    if TG_OP = 'INSERT' then perform public.log_activity('player_add', new.name);
    elsif TG_OP = 'DELETE' then perform public.log_activity('player_del', old.name); end if;
  elsif TG_TABLE_NAME = 'profiles' then
    if TG_OP = 'UPDATE' and new.role is distinct from old.role then perform public.log_activity('role', new.display_name || ': ' || new.role);
    elsif TG_OP = 'UPDATE' and new.content is distinct from old.content then perform public.log_activity(case when new.content then 'content_on' else 'content_off' end, new.display_name);
    elsif TG_OP = 'UPDATE' and new.player_id is distinct from old.player_id then perform public.log_activity('link', new.display_name);
    elsif TG_OP = 'DELETE' then perform public.log_activity('account_del', old.display_name); end if;
  elsif TG_TABLE_NAME = 'site_content' then
    perform public.log_activity('site_edit', null);
  end if;
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['matches','news','events','tevents','players','profiles','site_content'] loop
    execute format('drop trigger if exists activity_%1$s on public.%1$s', t);
    execute format('create trigger activity_%1$s after insert or update or delete on public.%1$s for each row execute function public.trg_activity()', t);
  end loop;
end $$;
grant select on public.activity_log to authenticated; -- RLS limits rows to admins
