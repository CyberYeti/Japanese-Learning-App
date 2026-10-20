-- Personal learning state. Static content (lessons, vocab, dictionary) is NOT stored here.
-- Run in the Supabase SQL editor. Every table is protected by row-level security.

create table if not exists items (
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  item_type      text not null check (item_type in ('word','grammar','kanji')),
  item_key       text not null,
  status         text not null default 'learning' check (status in ('learning','known')),
  manual_override boolean not null default false,
  source_lesson  text,
  introduced_at  timestamptz not null default now(),
  due            timestamptz not null default now(),
  stability      real not null default 0,
  difficulty     real not null default 0,
  elapsed_days   int  not null default 0,
  scheduled_days int  not null default 0,
  reps           int  not null default 0,
  lapses         int  not null default 0,
  state          smallint not null default 0,
  last_review    timestamptz,
  primary key (user_id, item_type, item_key)
);

create table if not exists review_log (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  item_type    text not null,
  item_key     text not null,
  rating       smallint not null,
  source       text not null check (source in ('passage','question','flashcard','lookup')),
  passage_id   uuid,
  reviewed_at  timestamptz not null default now()
);

create table if not exists passages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  created_at   timestamptz not null default now(),
  status       text not null default 'ready' check (status in ('ready','read')),
  lesson_id    text,
  topic        text,
  format       text check (format in ('prose','dialogue')),
  content      jsonb not null,
  target_items jsonb not null,
  coverage     real not null,
  read_at      timestamptz
);

create table if not exists lesson_progress (
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  lesson_id    text not null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);

create table if not exists settings (
  user_id         uuid primary key default auth.uid() references auth.users on delete cascade,
  interest_tags   text[] not null default '{}',
  politeness      text not null default 'polite' check (politeness in ('polite','plain','mixed')),
  daily_new_words int  not null default 10,
  known_kanji_threshold int not null default 3
);

-- Row-level security: each user can only touch their own rows.
alter table items           enable row level security;
alter table review_log      enable row level security;
alter table passages        enable row level security;
alter table lesson_progress enable row level security;
alter table settings        enable row level security;

drop policy if exists "own rows" on items;
create policy "own rows" on items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on review_log;
create policy "own rows" on review_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on passages;
create policy "own rows" on passages for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on lesson_progress;
create policy "own rows" on lesson_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on settings;
create policy "own rows" on settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
