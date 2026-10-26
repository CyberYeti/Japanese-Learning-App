-- Personal learning state. Static content (lessons, vocab, dictionary) is NOT stored here.
-- Run in the Supabase SQL editor. Every table is protected by row-level security.

-- For kanji, manual_override means the status was set by hand (tapping the kanji, known or not);
-- otherwise the app derives it from known words (SPEC §5.1) and the row isn't needed.
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
  learning_steps int  not null default 0,
  reps           int  not null default 0,
  lapses         int  not null default 0,
  state          smallint not null default 0,
  last_review    timestamptz,
  primary key (user_id, item_type, item_key)
);

-- Added with FSRS scheduling; for databases created before it.
alter table items add column if not exists learning_steps int not null default 0;

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

-- The pre-generation buffer (SPEC §5.3) looks up unread passages by age.
create index if not exists passages_ready_idx on passages (user_id, created_at) where status = 'ready';

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
  known_kanji_threshold int not null default 3,
  coverage_threshold real not null default 0.95 check (coverage_threshold > 0 and coverage_threshold <= 1)
);

-- Added with the settings page; for databases created before it.
alter table settings add column if not exists coverage_threshold real not null default 0.95
  check (coverage_threshold > 0 and coverage_threshold <= 1);

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

-- Save rescheduled items and append their review log in one transaction (SPEC §5.5, §5.7), for
-- passages and flashcards alike. Runs as the caller, so the row-level policies above still apply.
create or replace function record_reviews(
  p_items       jsonb,  -- rescheduled items rows
  p_reviews     jsonb,  -- [{item_type, item_key, rating, source}]
  p_reviewed_at timestamptz,
  p_passage_id  uuid default null
) returns void
language plpgsql security invoker as $$
begin
  update items i set
    status = r.status, manual_override = r.manual_override, due = r.due,
    stability = r.stability, difficulty = r.difficulty, elapsed_days = r.elapsed_days,
    scheduled_days = r.scheduled_days, learning_steps = r.learning_steps, reps = r.reps,
    lapses = r.lapses, state = r.state, last_review = r.last_review
  from jsonb_populate_recordset(null::items, p_items) r
  where i.user_id = auth.uid() and i.item_type = r.item_type and i.item_key = r.item_key;

  insert into review_log (item_type, item_key, rating, source, passage_id, reviewed_at)
  select r.item_type, r.item_key, r.rating, r.source, p_passage_id, p_reviewed_at
  from jsonb_to_recordset(p_reviews) as r(item_type text, item_key text, rating smallint, source text);
end;
$$;

-- Grade a read passage in one transaction (SPEC §5.5): mark it read, then record its reviews.
-- Returns false, changing nothing, if it was already read, so a passage is never graded twice.
create or replace function record_passage_review(
  p_passage_id  uuid,
  p_items       jsonb,
  p_reviews     jsonb,
  p_reviewed_at timestamptz
) returns boolean
language plpgsql security invoker as $$
begin
  update passages set status = 'read', read_at = p_reviewed_at
  where id = p_passage_id and status = 'ready';
  if not found then
    return false;
  end if;

  perform record_reviews(p_items, p_reviews, p_reviewed_at, p_passage_id);
  return true;
end;
$$;
