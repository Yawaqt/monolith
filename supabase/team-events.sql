-- =====================================================================
-- Monolith 40k – team events (5s / 8s): line-up, rounds, predictions,
-- pairings, results, live sharing. Applied to the live database 25 Nov 2026.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.tevents (
  id          bigint generated always as identity primary key,
  title       text not null,
  event_id    bigint references public.events on delete set null,
  size        int  not null default 5 check (size between 2 and 12),
  rules       jsonb not null default '{"no_dup": true, "chapters_as_sm": true, "disp_max": null}'::jsonb,
  lineup      jsonb not null default '[]'::jsonb,   -- [{player_id, faction, disposition}]
  share_code  text unique,
  share_pw    text,                                  -- bcrypt hash, null = no password
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tevent_rounds (
  id           bigint generated always as identity primary key,
  tevent_id    bigint not null references public.tevents on delete cascade,
  round_no     int not null default 1,
  opp_name     text,
  opp          jsonb not null default '[]'::jsonb,  -- [{faction, disposition, name}]
  predictions  jsonb not null default '{}'::jsonb,  -- {"ourIdx-oppIdx": predicted our GP 0..20}
  pairings     jsonb not null default '[]'::jsonb,  -- [{o: ourIdx, t: oppIdx, us: score, them: score}]
  logged       boolean not null default false,      -- results copied to the match log
  updated_at   timestamptz not null default now(),
  unique (tevent_id, round_no)
);

alter table public.tevents enable row level security;
alter table public.tevent_rounds enable row level security;

-- Team members read and edit (live together); captains create and delete.
drop policy if exists tevents_read on public.tevents;
create policy tevents_read on public.tevents for select to authenticated using (public.has_role('team'));
drop policy if exists tevents_insert on public.tevents;
create policy tevents_insert on public.tevents for insert to authenticated with check (public.has_role('captain'));
drop policy if exists tevents_update on public.tevents;
create policy tevents_update on public.tevents for update to authenticated using (public.has_role('team')) with check (public.has_role('team'));
drop policy if exists tevents_delete on public.tevents;
create policy tevents_delete on public.tevents for delete to authenticated using (public.has_role('captain'));

drop policy if exists trounds_read on public.tevent_rounds;
create policy trounds_read on public.tevent_rounds for select to authenticated using (public.has_role('team'));
drop policy if exists trounds_write on public.tevent_rounds;
create policy trounds_write on public.tevent_rounds for insert to authenticated with check (public.has_role('team'));
drop policy if exists trounds_update on public.tevent_rounds;
create policy trounds_update on public.tevent_rounds for update to authenticated using (public.has_role('team')) with check (public.has_role('team'));
drop policy if exists trounds_delete on public.tevent_rounds;
create policy trounds_delete on public.tevent_rounds for delete to authenticated using (public.has_role('captain'));

-- Only captains may change the share link, its password or the rules.
create or replace function public.protect_tevent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role('captain')
     and (new.share_code is distinct from old.share_code or new.share_pw is distinct from old.share_pw
          or new.rules is distinct from old.rules or new.size is distinct from old.size or new.title is distinct from old.title) then
    raise exception 'Only captains can change title, size, rules or sharing';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists protect_tevent on public.tevents;
create trigger protect_tevent before update on public.tevents for each row execute function public.protect_tevent();

-- The password hash never leaves the database: hide the column from the API.
revoke all on public.tevents, public.tevent_rounds from anon;
revoke select on public.tevents from authenticated;
grant select (id, title, event_id, size, rules, lineup, share_code, created_by, created_at, updated_at) on public.tevents to authenticated;
grant insert, update, delete on public.tevents to authenticated;
grant select, insert, update, delete on public.tevent_rounds to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Captain sets or clears the view-link password (stored as a bcrypt hash).
create or replace function public.set_tevent_password(p_id bigint, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.has_role('captain') then raise exception 'not allowed'; end if;
  update public.tevents set share_pw = case when coalesce(p_password, '') = '' then null else extensions.crypt(p_password, extensions.gen_salt('bf')) end where id = p_id;
end $$;
revoke all on function public.set_tevent_password(bigint, text) from public;
grant execute on function public.set_tevent_password(bigint, text) to authenticated;

create or replace function public.tevent_has_password(p_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select share_pw is not null from public.tevents where id = p_id and public.has_role('team')
$$;
grant execute on function public.tevent_has_password(bigint) to authenticated;

-- View-only access for anyone with the link (and the password, if one is set).
create or replace function public.public_tevent(p_code text, p_password text default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare t public.tevents;
begin
  select * into t from public.tevents where share_code = p_code and p_code is not null and length(p_code) >= 8;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if t.share_pw is not null and (p_password is null or extensions.crypt(p_password, t.share_pw) <> t.share_pw) then
    return jsonb_build_object('error', 'password');
  end if;
  return jsonb_build_object(
    'title', t.title, 'size', t.size, 'updated_at', t.updated_at,
    'lineup', (select coalesce(jsonb_agg(jsonb_build_object('player', p.name, 'faction', l->>'faction', 'disposition', l->>'disposition') order by ord), '[]'::jsonb)
               from jsonb_array_elements(t.lineup) with ordinality as x(l, ord) left join public.players p on p.id = (l->>'player_id')::bigint),
    'rounds', (select coalesce(jsonb_agg(jsonb_build_object('round_no', r.round_no, 'opp_name', r.opp_name, 'opp', r.opp, 'predictions', r.predictions, 'pairings', r.pairings) order by r.round_no), '[]'::jsonb)
               from public.tevent_rounds r where r.tevent_id = t.id));
end $$;
revoke all on function public.public_tevent(text, text) from public;
grant execute on function public.public_tevent(text, text) to anon, authenticated;

-- Live updates for the team
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.tevents; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.tevent_rounds; exception when duplicate_object then null; end;
  end if;
end $$;
