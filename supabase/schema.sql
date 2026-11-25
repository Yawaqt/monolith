-- =====================================================================
-- Monolith 40k – database schema for Supabase
-- Run this once in Supabase: SQL Editor → New query → paste → Run.
-- Roles: guest (anyone who signs up) < team < captain < admin
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists public.players (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  sort        int  not null default 0,
  active      boolean not null default true,
  armies      jsonb not null default '[]'::jsonb,   -- [{ "army": "...", "d1": "...", "d2": "..." }] up to 5
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  role          text not null default 'guest' check (role in ('guest','team','captain','admin')),
  player_id     bigint references public.players on delete set null,
  lang          text not null default 'de' check (lang in ('de','en')),
  created_at    timestamptz not null default now()
);

create table if not exists public.matches (
  id               bigint generated always as identity primary key,
  type             text not null default 'Practice',
  tournament       text,
  played_on        date not null,
  player_id        bigint not null references public.players on delete cascade,
  army             text not null,
  disposition      text,
  opp_faction      text not null,
  opp_disposition  text,
  opp_player_id    bigint references public.players on delete set null,  -- set = internal game vs. teammate
  opp_name         text,
  our_score        int check (our_score between 0 and 200),
  opp_score        int check (opp_score between 0 and 200),
  notes            text,
  created_by       uuid default auth.uid() references auth.users on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists matches_played_on_idx on public.matches (played_on desc);

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  starts_on   date not null,
  start_time  text,
  title       text not null,
  location    text,
  kind        text,
  note        text,
  team_size   int not null default 5 check (team_size between 1 and 20),
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.rsvps (
  event_id   bigint not null references public.events on delete cascade,
  player_id  bigint not null references public.players on delete cascade,
  status     text not null check (status in ('yes','maybe','no')),
  updated_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

create table if not exists public.payments (
  id           bigint generated always as identity primary key,
  due_on       date,
  event_title  text,
  event_id     bigint references public.events on delete set null,
  player_id    bigint not null references public.players on delete cascade,
  amount       numeric(10,2) not null default 0,
  paid         boolean not null default false,
  paid_on      date,
  note         text,
  created_at   timestamptz not null default now()
);

create table if not exists public.ratings (
  player_id  bigint not null references public.players on delete cascade,
  faction    text not null,
  value      numeric(2,1) not null check (value between 1 and 5),
  primary key (player_id, faction)
);

create table if not exists public.opponent_teams (
  id          bigint generated always as identity primary key,
  name        text not null,
  rows        jsonb not null default '[]'::jsonb,   -- [{ "faction": "...", "disposition": "..." }] up to 8
  note        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.pairings (
  id          bigint generated always as identity primary key,
  title       text not null default '',
  basis       text not null default 'team' check (basis in ('team','player')),
  opp         jsonb not null default '[]'::jsonb,   -- 5 opponent factions
  ours        jsonb not null default '[]'::jsonb,   -- [{ "player_id": 1, "army": "..." }] x5
  updated_at  timestamptz not null default now()
);

create table if not exists public.settings (
  key    text primary key,
  value  jsonb not null
);

create table if not exists public.collections (
  user_id     uuid primary key default auth.uid() references auth.users on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------- Role helpers ----------------------------------------------

create or replace function public.role_rank(r text) returns int
language sql immutable as $$
  select case r when 'admin' then 4 when 'captain' then 3 when 'team' then 2 when 'guest' then 1 else 0 end
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon')
$$;

create or replace function public.has_role(min_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.role_rank(public.my_role()) >= public.role_rank(min_role)
$$;

create or replace function public.my_player() returns bigint
language sql stable security definer set search_path = public as $$
  select player_id from public.profiles where id = auth.uid()
$$;

-- New sign-up → profile. The very first account becomes admin, everyone after that is a guest.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles where role = 'admin') then 'guest' else 'admin' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change roles or player links (the SQL editor, where auth.uid() is null, may too).
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role('admin')
     and (new.role is distinct from old.role or new.player_id is distinct from old.player_id) then
    raise exception 'Only admins can change roles or player links';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- Team members may only edit the armies of their own player row, not its name or order.
create or replace function public.protect_player() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role('captain')
     and (new.name is distinct from old.name or new.sort is distinct from old.sort or new.active is distinct from old.active) then
    raise exception 'Only captains can rename or reorder players';
  end if;
  return new;
end $$;

drop trigger if exists protect_player on public.players;
create trigger protect_player before update on public.players
  for each row execute function public.protect_player();

-- ---------- Row level security ----------------------------------------

alter table public.players        enable row level security;
alter table public.profiles       enable row level security;
alter table public.matches        enable row level security;
alter table public.events         enable row level security;
alter table public.rsvps          enable row level security;
alter table public.payments       enable row level security;
alter table public.ratings        enable row level security;
alter table public.opponent_teams enable row level security;
alter table public.pairings       enable row level security;
alter table public.settings       enable row level security;
alter table public.collections    enable row level security;

-- players: team reads; captains manage; a team member edits own row (armies)
drop policy if exists players_read on public.players;
create policy players_read on public.players for select to authenticated using (public.has_role('team'));
drop policy if exists players_insert on public.players;
create policy players_insert on public.players for insert to authenticated with check (public.has_role('captain'));
drop policy if exists players_update on public.players;
create policy players_update on public.players for update to authenticated
  using (public.has_role('captain') or (public.has_role('team') and id = public.my_player()))
  with check (public.has_role('captain') or (public.has_role('team') and id = public.my_player()));
drop policy if exists players_delete on public.players;
create policy players_delete on public.players for delete to authenticated using (public.has_role('admin'));

-- profiles: own row, captains see everyone, admins edit everyone
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.has_role('captain'));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role('admin')) with check (id = auth.uid() or public.has_role('admin'));
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated using (public.has_role('admin') and id <> auth.uid());

-- matches: team reads and logs own games; captains edit all; authors edit their own
drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select to authenticated using (public.has_role('team'));
drop policy if exists matches_insert on public.matches;
create policy matches_insert on public.matches for insert to authenticated with check (
  public.has_role('captain') or (public.has_role('team') and (player_id = public.my_player() or opp_player_id = public.my_player())));
drop policy if exists matches_update on public.matches;
create policy matches_update on public.matches for update to authenticated
  using (public.has_role('captain') or (public.has_role('team') and created_by = auth.uid()))
  with check (public.has_role('captain') or (public.has_role('team') and created_by = auth.uid()));
drop policy if exists matches_delete on public.matches;
create policy matches_delete on public.matches for delete to authenticated
  using (public.has_role('captain') or (public.has_role('team') and created_by = auth.uid()));

-- events: team reads; captains manage
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated using (public.has_role('team'));
drop policy if exists events_write on public.events;
create policy events_write on public.events for all to authenticated using (public.has_role('captain')) with check (public.has_role('captain'));

-- rsvps: team reads; each player answers for themselves, captains for anyone
drop policy if exists rsvps_read on public.rsvps;
create policy rsvps_read on public.rsvps for select to authenticated using (public.has_role('team'));
drop policy if exists rsvps_write on public.rsvps;
create policy rsvps_write on public.rsvps for all to authenticated
  using (public.has_role('captain') or (public.has_role('team') and player_id = public.my_player()))
  with check (public.has_role('captain') or (public.has_role('team') and player_id = public.my_player()));

-- payments (Kasse): admins only; team members see their own entries
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated
  using (public.has_role('admin') or (public.has_role('team') and player_id = public.my_player()));
drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- ratings (Master matrix): team reads; own column, captains all
drop policy if exists ratings_read on public.ratings;
create policy ratings_read on public.ratings for select to authenticated using (public.has_role('team'));
drop policy if exists ratings_write on public.ratings;
create policy ratings_write on public.ratings for all to authenticated
  using (public.has_role('captain') or (public.has_role('team') and player_id = public.my_player()))
  with check (public.has_role('captain') or (public.has_role('team') and player_id = public.my_player()));

-- opponent teams, pairings, settings: team reads; captains manage
drop policy if exists opp_read on public.opponent_teams;
create policy opp_read on public.opponent_teams for select to authenticated using (public.has_role('team'));
drop policy if exists opp_write on public.opponent_teams;
create policy opp_write on public.opponent_teams for all to authenticated using (public.has_role('captain')) with check (public.has_role('captain'));
drop policy if exists pairings_read on public.pairings;
create policy pairings_read on public.pairings for select to authenticated using (public.has_role('team'));
drop policy if exists pairings_write on public.pairings;
create policy pairings_write on public.pairings for all to authenticated using (public.has_role('captain')) with check (public.has_role('captain'));
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (public.has_role('team'));
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all to authenticated using (public.has_role('captain')) with check (public.has_role('captain'));

-- collections (apps): every signed-in user owns exactly their own row
drop policy if exists collections_own on public.collections;
create policy collections_own on public.collections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Grants -----------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.has_role(text), public.my_role(), public.my_player(), public.role_rank(text) to authenticated;
revoke all on all tables in schema public from anon;
