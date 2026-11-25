-- =====================================================================
-- Monolith 40k – team page content, player profiles, tournament tool (Nov 2026)
-- =====================================================================

-- ---------- Editable public content (about text, group photos)
create table if not exists public.site_content (
  key        text primary key check (key in ('about', 'group_photos')),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
drop policy if exists site_read on public.site_content;
create policy site_read on public.site_content for select to anon, authenticated using (true);
drop policy if exists site_write on public.site_content;
create policy site_write on public.site_content for all to authenticated using (public.has_role('captain')) with check (public.has_role('captain'));
revoke all on public.site_content from anon;
grant select on public.site_content to anon;
grant select, insert, update, delete on public.site_content to authenticated;

-- ---------- Player profile: favourite army and a short text (filled in by the player)
alter table public.players add column if not exists fav_army text check (fav_army is null or length(fav_army) <= 60);
alter table public.players add column if not exists bio text check (bio is null or length(bio) <= 600);

drop function if exists public.public_players();
create function public.public_players()
returns table (name text, sort int, armies text[], bcp_url text, photo_url text, fav_army text, bio text)
language sql stable security definer set search_path = public as $$
  select p.name, p.sort,
         coalesce(array(select m.army from public.matches m
                        where m.player_id = p.id and m.type in ('Tournament', 'Team Tournament')
                        group by m.army order by count(*) desc, max(m.played_on) desc), '{}'),
         p.bcp_url, p.photo_url, p.fav_army, p.bio
  from public.players p
  where p.active
  order by p.sort, p.name
$$;
revoke all on function public.public_players() from public;
grant execute on function public.public_players() to anon, authenticated;

-- ---------- Tournament tool: matrix snapshot, opponent teams and notes per team event
alter table public.tevents add column if not exists matrix jsonb not null default '{}'::jsonb;     -- {"army|faction": rating 1–5}
alter table public.tevents add column if not exists opponents jsonb not null default '[]'::jsonb;  -- [{id,name,note,players:[{faction,disposition,name,note}]}]
alter table public.tevents add column if not exists notes text check (notes is null or length(notes) <= 8000);
alter table public.tevent_rounds add column if not exists opp_team text;
alter table public.tevent_rounds add column if not exists notes text check (notes is null or length(notes) <= 8000);
grant select (matrix, opponents, notes) on public.tevents to authenticated;
