# Japanese Learning App: Spec

A personal web app for learning Japanese. Its main feature is AI-generated practice passages built almost entirely from words and grammar you already know, with spaced repetition built into the reading.

Status: design settled 2026-10-19. Nothing built yet.

---

## 1. Decisions at a glance

| Area | Decision |
|---|---|
| Users | Just me (single user), desktop + phone |
| Starting point | Kana known; begin at Tae Kim *Grammar Guide* → Basic Grammar |
| Lesson content | Tae Kim's Grammar Guide, imported once into the app (CC BY-NC-SA, attributed) |
| Vocab | Words from each lesson's examples + JLPT N5→N1 community lists to fill in |
| Item states | `new` → `learning` → `known`, for words, grammar points, and kanji |
| Main practice | Passages. Reviews happen *inside* passages; flashcards are a secondary mode |
| Passage grading | Implicit (tapped = forgot, untapped due item = remembered) + 1–2 optional comprehension questions on due grammar |
| Passage format | Furigana only on unlearned kanji; translation hidden until revealed; です/ます form to start; 4–8 sentences, growing with level |
| Topics | Interest tags set once + everyday situations; alternate prose and short dialogues |
| Kanji learned | Automatic once ~3 known words use it; manual override by tapping |
| Pacing | I choose when to advance; app shows a "ready" indicator. ~15–20 min/day |
| Frontend | Svelte (SvelteKit, static build) + TypeScript |
| Hosting | GitHub Pages, public repo, $0 |
| Database + login | Supabase free tier (Postgres, magic-link email login, row-level security) |
| Tokenizer | kuromoji.js, in the browser |
| LLM | Google Gemini Flash (free tier), called from the browser behind a `generate()` wrapper |
| API key | Entered once per device, kept in that browser only, never committed |
| SRS scheduler | ts-fsrs (TypeScript port of FSRS) |
| Dictionary | JMdict (via the jmdict-simplified JSON release), served as static shards |
| Connectivity | Online-only MVP; 2 passages pre-generated so they open instantly |
| Python's role | One-time script that scrapes Tae Kim's lessons into JSON |

---

## 2. Architecture

Everything runs in the browser. There is no server of my own.

```
                 GitHub Pages (static files)
   ┌───────────────────────────────────────────────────┐
   │ Svelte app (TS)                                   │
   │ /data/lessons/*.json   grammar_points.json        │
   │ /data/vocab/n5..n1.json  /data/dict/shards/*.json │
   │ /kuromoji/*.dat.gz  (tokenizer dictionary)        │
   └───────────────────────────────────────────────────┘
        │ in browser                     │ in browser
        ▼                                ▼
  Gemini API (generate passages,   Supabase (my progress:
  explanations, questions)         items, reviews, passages)
```

- **Static data** (lessons, grammar definitions, vocab lists, dictionary) is the same for everyone, so it lives in the repo and ships with the site.
- **Personal state** (what I know, review history, generated passages) lives in Supabase, protected by row-level security (`user_id = auth.uid()`). The Supabase anon key is safe to put in the frontend *because* RLS is on.
- **Gemini key** sits in `localStorage` on each device. A settings page lets me paste it in.

### Things to know about the free services
- **Gemini free tier:** Flash / Flash-Lite models only; limits are per project and Google has cut them before without much warning. Inputs/outputs may be used by Google to improve models and read by reviewers. That's fine for study passages; just don't put anything private in prompts.
- **Supabase free tier:** projects pause after 7 days without activity (data is kept; restore manually from the dashboard). 500 MB database is far more than needed.
- **GitHub Pages on a free personal account** requires a public repo. The site itself is public, but nothing personal is in it.

---

## 3. Content and data pipeline (one-time, run locally)

### 3.1 Tae Kim lessons → `data/lessons/`
`scripts/import_taekim.py` (Python, requests + BeautifulSoup):
1. Walk the Grammar Guide table of contents in order (Writing System → Basic Grammar → Essential Grammar → Special Expressions → Advanced Topics).
2. For each page, save: `id`, `order`, `section`, `title`, `source_url`, cleaned HTML body, and the list of example sentences (Japanese + English).
3. Write one JSON file per lesson plus `lessons/index.json`.

Licensing: the Tae Kim content is CC BY-NC-SA. Every lesson page in the app shows attribution + a link to the original, and the `data/lessons/` folder carries its own LICENSE file (CC BY-NC-SA 4.0) separate from the code's license.

### 3.2 Grammar points → `data/grammar_points.json`
This is the most hand-made part of the project. For each lesson, list the grammar it teaches:

```json
{
  "id": "te-iru",
  "name": "～ている (ongoing action / state)",
  "lesson_id": "essential-te-iru",
  "level": 2,
  "matcher": [
    { "pos": "動詞", "conjugated_form_prefix": "連用" },
    { "surface": ["て", "で"] },
    { "basic_form": "いる" }
  ],
  "prompt_hint": "Use ～ている for actions in progress or resulting states."
}
```

- `matcher` is a small token-pattern language run over kuromoji output, so the app can check whether a passage actually used a grammar point.
- Draft these with AI help lesson by lesson, then test each matcher against the lesson's own example sentences (they should all match).
- Only Basic Grammar is needed for the MVP (roughly 15–25 points).

### 3.3 Vocab → `data/vocab/`
- **Lesson words:** a small TS script (`scripts/build_data.ts`) tokenizes each lesson's example sentences with the *same* kuromoji dictionary the app uses (so base forms match at runtime), drops particles/auxiliaries/punctuation, and attaches the content words to the lesson.
- **JLPT lists:** openly shared community N5→N1 lists, converted to `{ id, kanji, kana, gloss, jlpt }`. N5 overlaps heavily with early Tae Kim lessons; duplicates merge by dictionary form.
- Each word gets a stable key: its dictionary form + reading, e.g. `食べる|たべる`.

### 3.4 Dictionary → `data/dict/`
- Start with jmdict-simplified's `jmdict-eng-common` (smaller, covers almost everything a beginner passage will contain).
- Split into shards by the first character of the headword so tap-to-define only fetches one small file.
- Fallback for words not found: ask Gemini for a one-line definition.
- JMdict is CC BY-SA (EDRDG). Credit it in the app's About page.

---

## 4. Database schema (Supabase / Postgres)

All tables have `user_id uuid references auth.users` and an RLS policy `user_id = auth.uid()` for select/insert/update/delete. Full SQL goes in `supabase/schema.sql`.

```sql
-- One row per word / grammar point / kanji I've started learning.
create table items (
  user_id        uuid not null default auth.uid(),
  item_type      text not null check (item_type in ('word','grammar','kanji')),
  item_key       text not null,          -- '食べる|たべる', 'te-iru', '食'
  status         text not null default 'learning'
                 check (status in ('learning','known')),
  manual_override boolean not null default false,
  source_lesson  text,                   -- lesson that introduced it (null for JLPT fill-in)
  introduced_at  timestamptz not null default now(),
  -- FSRS card state (mirrors ts-fsrs Card)
  due            timestamptz not null default now(),
  stability      real not null default 0,
  difficulty     real not null default 0,
  elapsed_days   int  not null default 0,
  scheduled_days int  not null default 0,
  reps           int  not null default 0,
  lapses         int  not null default 0,
  state          smallint not null default 0,   -- New/Learning/Review/Relearning
  last_review    timestamptz,
  primary key (user_id, item_type, item_key)
);

create table review_log (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid(),
  item_type    text not null,
  item_key     text not null,
  rating       smallint not null,        -- 1 Again, 3 Good (2/4 used by flashcards)
  source       text not null check (source in ('passage','question','flashcard','lookup')),
  passage_id   uuid,
  reviewed_at  timestamptz not null default now()
);

create table passages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),
  created_at   timestamptz not null default now(),
  status       text not null default 'ready' check (status in ('ready','read')),
  lesson_id    text,
  topic        text,
  format       text check (format in ('prose','dialogue')),
  content      jsonb not null,           -- sentences, tokens, translation, questions
  target_items jsonb not null,           -- due items + target grammar it was built around
  coverage     real not null,
  read_at      timestamptz
);

create table lesson_progress (
  user_id      uuid not null default auth.uid(),
  lesson_id    text not null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);

create table settings (
  user_id         uuid primary key default auth.uid(),
  interest_tags   text[] not null default '{}',
  politeness      text not null default 'polite' check (politeness in ('polite','plain','mixed')),
  daily_new_words int  not null default 10,
  known_kanji_threshold int not null default 3
);
```

Items with no row are implicitly **new**. Lessons, grammar definitions, and vocab metadata are *not* in the database; they come from the static JSON.

---

## 5. Core logic

### 5.1 Item status
- **new:** no row in `items`.
- **learning:** row exists, FSRS stability below 7 days (or still in the Learning/Relearning state).
- **known:** FSRS state is Review *and* stability ≥ 7 days, or `manual_override` is set.
- A lapse (rated Again) drops a known item back to learning.
- **Kanji:** becomes known automatically when ≥ `known_kanji_threshold` (default 3) known words contain it. Tapping a kanji lets me mark it known/unknown manually (`manual_override`).

The 7-day threshold is a starting guess. Tune it after a few weeks of use.

### 5.2 Introducing items
- Marking a lesson **complete** inserts its grammar points and lesson words as `learning` items (due now).
- Each day, up to `daily_new_words` JLPT words (lowest level first, skipping ones already present) are added. They're introduced through passages: a passage may include up to 3 brand-new words, shown highlighted with a gloss.

### 5.3 Passage generation (the generate-and-check loop)

**Step 1: build the request.**
- **Target grammar:** current lesson's grammar points + up to 2 due grammar items.
- **Due items:** up to 8 words/grammar whose FSRS `due` ≤ now, oldest first.
- **Allowed vocabulary:** all `known` + `learning` words, sent as a compact list of dictionary forms. (At a few thousand words this is still only a few thousand tokens.)
- **New words budget:** 0–3 words from the current lesson / today's JLPT batch.
- **Topic:** random pick from my interest tags or a built-in list of everyday situations (shopping, school, weekend plans, cooking…).
- **Format:** alternate prose and dialogue.
- **Length:** `sentences = min(4 + floor(known_words / 75), 20)`, starting at 4–8 and growing with my vocab. Above ~12 sentences, allow two paragraphs or a longer dialogue. Starting heuristic; tune later.
- **Politeness:** from settings (です/ます to start).

**Step 2: call Gemini** with structured JSON output (`responseMimeType: "application/json"` + a schema):

```json
{
  "title": "週末の予定",
  "sentences": [
    { "jp": "土曜日に友達と映画を見ます。", "en": "On Saturday I will watch a movie with a friend." }
  ],
  "used_grammar": ["te-iru", "masu-form"],
  "questions": [
    { "q": "...", "choices": ["...", "...", "..."], "answer": 0, "grammar_id": "te-iru" }
  ]
}
```
The prompt tells it: write natural Japanese in normal kanji/kana (no furigana; the app adds that), use only the allowed vocabulary plus the listed new words, feature every target grammar point and due item, stay in the chosen politeness level, and write 1–2 comprehension questions that require understanding the target grammar.

**Step 3: check it in code.**
1. Tokenize every sentence with kuromoji.
2. Ignore particles, auxiliaries, punctuation, numbers, and proper nouns.
3. Map each remaining token's dictionary form to a vocab key.
4. `coverage = known-or-learning content tokens / all content tokens`.
5. Run grammar matchers to confirm the target grammar actually appears.

**Step 4: accept or retry.**
- Accept if coverage ≥ 95% and all target grammar is present.
- Otherwise retry (max 2 retries), telling Gemini exactly which words to replace and which grammar is missing.
- After 3 attempts, keep the best one. Any unknown word left over just becomes tap-to-define.

**Budget:** ≤ 3 Gemini calls per passage; at ~5–10 passages a day that's ~30 calls, far under free-tier daily limits.

**Pre-generation:** keep 2 passages with status `ready`. After I finish one, generate a replacement in the background. Discard ready passages older than 24 hours, since the due items they were built around will have shifted.

### 5.4 Rendering a passage
- Each token is tappable. Tap shows dictionary form, reading, and gloss (JMdict shard lookup).
- **Furigana:** shown only on kanji that aren't known. Reading comes from kuromoji (katakana → hiragana), aligned so okurigana isn't duplicated (食べる → 食[た]べる).
- New words are lightly highlighted; due items are not marked (that would give away the review).
- English translation is hidden per sentence and for the whole passage; reveal on tap.

### 5.5 Grading a passage (when I press "Done")
| Situation | FSRS rating |
|---|---|
| Due item appeared, I didn't tap it | Good |
| Due item appeared, I tapped it | Again |
| Known, not-due word that I tapped | Again (lapse; I forgot it) |
| Known, not-due word I didn't tap | no review logged |
| Comprehension question correct | Good for its `grammar_id` |
| Comprehension question wrong | Again for its `grammar_id` |
| Word I tapped that was never introduced | offer "add to learning" |

Grammar items only get reviewed through questions, not taps, because tapping shows a word, not whether I understood a structure. Questions are optional; skipping them means due grammar just stays due.

All ratings go through ts-fsrs, update `items`, and append to `review_log`.

### 5.6 Lessons
- The lesson reader shows the imported Tae Kim page with attribution.
- **AI side panel:** highlight any text → "Explain" sends the highlighted text + lesson title + surrounding paragraph to Gemini. Also a "Quiz me" button for 3 quick questions on the lesson.
- **"Practice this lesson"** generates a passage that targets this lesson's grammar.
- **"Mark complete"** introduces the lesson's items (5.2).
- **Ready indicator** for the next lesson: shows when ≥ 80% of the current lesson's items have stability ≥ 3 days. It's advisory only; I can always move on.

### 5.7 Flashcards (secondary mode)
- Same `items` table and FSRS cards, just shown as cards (word → reading + meaning; grammar → example sentence).
- Useful for clearing due items that passages haven't covered.
- Uses all four FSRS ratings (Again/Hard/Good/Easy).

---

## 6. Code layout

```
/
├─ src/
│  ├─ lib/
│  │  ├─ ai/generate.ts        # the ONLY place that knows about Gemini; swap providers here
│  │  ├─ ai/prompts.ts         # passage, explain, quiz prompts + JSON schemas
│  │  ├─ nlp/tokenize.ts       # Token type + kuromoji output → Token
│  │  ├─ nlp/kuromoji.ts       # builds kuromoji from caller-supplied IPADIC files
│  │  ├─ nlp/tokenizer.worker.ts  # worker: Cache API dictionary loading + tokenizing (ADR 0001)
│  │  ├─ nlp/tokenizer-client.ts  # main-thread promise wrapper around the worker
│  │  ├─ nlp/grammar.ts        # matcher engine for grammar_points.json
│  │  ├─ nlp/furigana.ts       # reading alignment
│  │  ├─ nlp/coverage.ts       # coverage calculation
│  │  ├─ srs/scheduler.ts      # ts-fsrs wrapper, status rules, grading table
│  │  ├─ db/supabase.ts        # client + typed queries
│  │  └─ dict/lookup.ts        # JMdict shard loader
│  ├─ routes/
│  │  ├─ +page.svelte          # home: today's passage, due count, current lesson
│  │  ├─ lessons/[id]/         # lesson reader + AI panel
│  │  ├─ read/[passageId]/     # passage reader
│  │  ├─ reader/               # scratch reader: paste any text (build step 2)
│  │  ├─ cards/                # flashcards
│  │  └─ settings/             # Gemini key, interests, politeness, thresholds
│  └─ components/              # Token, Furigana, SidePanel, QuestionCard…
├─ static/
│  ├─ data/lessons/  data/grammar_points.json  data/vocab/  data/dict/
│  └─ kuromoji/                # dictionary .dat.gz files
├─ scripts/
│  ├─ import_taekim.py         # one-time scrape (Python)
│  └─ build_data.ts            # tokenize lesson examples, build vocab + dict shards
├─ supabase/schema.sql
└─ .github/workflows/deploy.yml  # build + publish to GitHub Pages
```

Hosting notes:
- SvelteKit with `adapter-static`, `fallback: '404.html'` (SPA mode), and `paths.base` set to the repo name.
- Supabase magic-link redirect URL must be set to the GitHub Pages URL (and `localhost` for development).
- `.env` holds the Supabase URL + anon key for local dev. The Gemini key is never in any file.

---

## 7. MVP build order

Each step ends with something usable.

1. **Skeleton.** Create the repo, SvelteKit static site, deploy "hello" to GitHub Pages via Actions. Create the Supabase project, run `schema.sql`, get magic-link login working on the deployed site.
2. **Reader without AI.** Load kuromoji in the browser; paste any Japanese text and render it as tappable tokens with furigana and JMdict lookups. (This proves the hardest browser pieces early.)
3. **Content.** Run the Python import for Basic Grammar only; hand-write + test grammar points for those lessons; build N5 vocab JSON and dictionary shards. Lesson reader page with attribution and "Mark complete."
4. **Passages.** `generate()` wrapper for Gemini, settings page for the key, the generate-and-check loop, the passage reader.
5. **Spaced repetition.** ts-fsrs integration, grading table from 5.5, comprehension questions, due counts on the home page.
6. **Lesson AI panel.** Explain-highlighted-text and Quiz-me.
7. **Polish.** Pre-generation, ready indicator, interest tags, prose/dialogue alternation, kanji auto-learning, length scaling, flashcard mode.

**Later (not MVP):** text-to-speech, plain-form / mixed politeness, importing the rest of the Grammar Guide, offline mode, stats page.

---

## 8. Risks and things to watch

- **Grammar matchers are the biggest manual effort.** Keep them simple at first; a passage missing a target grammar point is only a retry, not a failure.
- **kuromoji dictionary is large** (~12 MB+ download). Lazy-load it once and let the browser cache it; show a loading state on first visit. Test that GitHub Pages serves the `.dat.gz` files in a way kuromoji can decompress. kuromoji.js is old and unmaintained; maintained forks exist if it causes trouble.
- **Tokenizer vs. vocab mismatch.** Always build vocab keys with the same kuromoji dictionary the app uses (that's why `build_data.ts` exists).
- **LLM drift.** Gemini will sometimes ignore the vocab list or mix politeness levels. The coverage check + retry loop handles the first; add a politeness check (look for です/ます vs. plain endings) if the second becomes common.
- **Free tiers change.** Everything Gemini-specific stays inside `ai/generate.ts` so switching models or providers is a one-file change.
- **Supabase pause** after 7 idle days. Not an issue with daily use; just restore from the dashboard after a break.
- **Status thresholds** (7-day "known", 95% coverage, 3-word kanji rule, length formula) are guesses. Make them settings and tune them after real use.

---

## 9. Credits to include in the app

- Tae Kim's Guide to Learning Japanese, CC BY-NC-SA (lesson content)
- JMdict / EDRDG, CC BY-SA (dictionary)
- kuromoji.js (Apache 2.0) with IPADIC
- ts-fsrs (MIT)
- Source of the JLPT word lists used
