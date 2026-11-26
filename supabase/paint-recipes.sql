-- Paint recipes: every account can keep its own recipes; shared ones are public (with the author's display name).
create table if not exists public.paint_recipes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text,
  title text not null check (char_length(title) between 1 and 80),
  faction text,
  part text,
  steps jsonb not null default '[]'::jsonb,
  notes text check (notes is null or char_length(notes) <= 2000),
  photos text[] not null default '{}',
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists paint_recipes_user on public.paint_recipes (user_id);
create index if not exists paint_recipes_shared on public.paint_recipes (shared, updated_at desc);
alter table public.paint_recipes enable row level security;
drop policy if exists recipes_read on public.paint_recipes;
drop policy if exists recipes_insert on public.paint_recipes;
drop policy if exists recipes_update on public.paint_recipes;
drop policy if exists recipes_delete on public.paint_recipes;
create policy recipes_read on public.paint_recipes for select using (shared or user_id = auth.uid());
create policy recipes_insert on public.paint_recipes for insert to authenticated with check (user_id = auth.uid());
create policy recipes_update on public.paint_recipes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- admins may remove inappropriate shared recipes
create policy recipes_delete on public.paint_recipes for delete to authenticated using (user_id = auth.uid() or public.has_role('admin'));
grant select on public.paint_recipes to anon, authenticated;
grant insert, update, delete on public.paint_recipes to authenticated;

-- author name + timestamps are set by the server, not by the client
create or replace function public.paint_recipes_stamp() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  new.author_name := (select display_name from public.profiles where id = new.user_id);
  new.updated_at := now();
  if TG_OP = 'INSERT' then new.created_at := now(); end if;
  if jsonb_typeof(new.steps) <> 'array' or jsonb_array_length(new.steps) > 40 then raise exception 'too many steps'; end if;
  if coalesce(array_length(new.photos, 1), 0) > 6 then raise exception 'too many photos'; end if;
  return new;
end $$;
drop trigger if exists paint_recipes_stamp on public.paint_recipes;
create trigger paint_recipes_stamp before insert or update on public.paint_recipes for each row execute function public.paint_recipes_stamp();

-- photo uploads: every signed-in account may write into its own folder recipes/<uid>/
drop policy if exists media_recipes_insert on storage.objects;
drop policy if exists media_recipes_update on storage.objects;
create policy media_recipes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and name like 'recipes/' || auth.uid()::text || '/%');
create policy media_recipes_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and name like 'recipes/' || auth.uid()::text || '/%')
  with check (bucket_id = 'media' and name like 'recipes/' || auth.uid()::text || '/%');
