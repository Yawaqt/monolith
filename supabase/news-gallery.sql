-- News: category, picture gallery and linked tournaments (applied 26 Nov 2026).
alter table public.news add column if not exists category text not null default 'News';
alter table public.news drop constraint if exists news_category_check;
alter table public.news add constraint news_category_check check (category in ('News', 'Advertisement', 'Tournament Recap', 'Member'));
alter table public.news add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.news drop constraint if exists news_images_check;
alter table public.news add constraint news_images_check check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 60);
alter table public.news add column if not exists tournaments text[] not null default '{}';
alter table public.news drop constraint if exists news_tournaments_check;
alter table public.news add constraint news_tournaments_check check (cardinality(tournaments) <= 20);
create index if not exists news_category_idx on public.news (category);
