-- =====================================================================
-- Monolith 40k – news (blog) and player photos (Nov 2026)
-- =====================================================================

-- ---------- News articles
create table if not exists public.news (
  id          bigint generated always as identity primary key,
  title       text not null check (length(title) between 1 and 160),
  body        text not null default '' check (length(body) <= 40000),
  cover_url   text check (cover_url is null or cover_url ~ '^https://'),
  published   boolean not null default true,
  author_id   uuid default auth.uid() references auth.users on delete set null,
  author_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists news_created_idx on public.news (created_at desc);
alter table public.news enable row level security;

-- Everyone (also visitors without an account) reads published articles; members also see drafts.
drop policy if exists news_read on public.news;
drop policy if exists news_read_anon on public.news;
create policy news_read_anon on public.news for select to anon using (published);
create policy news_read on public.news for select to authenticated using (published or public.has_role('team'));
-- Members write articles; they edit their own, captains and admins edit all.
drop policy if exists news_insert on public.news;
create policy news_insert on public.news for insert to authenticated with check (public.has_role('team') and author_id = auth.uid());
drop policy if exists news_update on public.news;
create policy news_update on public.news for update to authenticated
  using (public.has_role('captain') or (public.has_role('team') and author_id = auth.uid()))
  with check (public.has_role('captain') or (public.has_role('team') and author_id = auth.uid()));
drop policy if exists news_delete on public.news;
create policy news_delete on public.news for delete to authenticated
  using (public.has_role('captain') or (public.has_role('team') and author_id = auth.uid()));
revoke all on public.news from anon;
grant select on public.news to anon;
grant select, insert, update, delete on public.news to authenticated;

-- ---------- Player photo
alter table public.players add column if not exists photo_url text check (photo_url is null or photo_url ~ '^https://');

drop function if exists public.public_players();
create function public.public_players()
returns table (name text, sort int, armies text[], bcp_url text, photo_url text)
language sql stable security definer set search_path = public as $$
  select p.name, p.sort,
         coalesce(array(select m.army from public.matches m
                        where m.player_id = p.id and m.type in ('Tournament', 'Team Tournament')
                        group by m.army order by count(*) desc, max(m.played_on) desc), '{}'),
         p.bcp_url, p.photo_url
  from public.players p
  where p.active
  order by p.sort, p.name
$$;
revoke all on function public.public_players() from public;
grant execute on function public.public_players() to anon, authenticated;

-- ---------- Image storage: public bucket "media" (player photos, news pictures)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists media_insert on storage.objects;
create policy media_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.has_role('team'));
drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects for update to authenticated using (bucket_id = 'media' and public.has_role('team')) with check (bucket_id = 'media' and public.has_role('team'));
drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and (owner = auth.uid() or public.has_role('captain')));
