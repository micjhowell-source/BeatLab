-- SOUNDS
create table sounds (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  symbol      text not null,
  category    text not null,
  description text,
  technique   text[],
  tips        text[],
  synth_config jsonb,
  created_at  timestamptz default now()
);

-- SKILL GRAPH EDGES
create table skill_edges (
  id              uuid primary key default gen_random_uuid(),
  from_sound_id   uuid references sounds(id) on delete cascade,
  to_sound_id     uuid references sounds(id) on delete cascade,
  condition_type  text not null default 'mastery',
  condition_value jsonb,
  label           text,
  unique (from_sound_id, to_sound_id)
);

-- REFERENCE CLIPS
create table reference_clips (
  id             uuid primary key default gen_random_uuid(),
  sound_id       uuid references sounds(id) on delete cascade,
  storage_path   text not null,
  label          text,
  feature_vector float[] not null,
  duration_ms    int,
  uploaded_by    uuid references auth.users(id),
  created_at     timestamptz default now()
);

-- USER PROGRESS
create table user_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  sound_id      uuid references sounds(id) on delete cascade,
  is_unlocked   boolean default false,
  is_mastered   boolean default false,
  best_score    int default 0,
  attempt_count int default 0,
  score_history int[],
  last_attempt  timestamptz,
  unique (user_id, sound_id)
);

-- SEQUENCES
create table sequences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  notation    text not null,
  bpm         int default 90,
  step_count  int default 16,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- SEQUENCE ATTEMPTS
create table sequence_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  sequence_id     uuid references sequences(id) on delete cascade,
  overall_score   int,
  timing_score    int,
  sound_score     int,
  per_hit_scores  jsonb,
  created_at      timestamptz default now()
);

-- USER SKILL CONNECTIONS
create table user_skill_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  from_sound_id   uuid references sounds(id) on delete cascade,
  to_sound_id     uuid references sounds(id) on delete cascade,
  note            text,
  created_at      timestamptz default now(),
  unique (user_id, from_sound_id, to_sound_id)
);

-- USER GOALS
create table user_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  sound_id    uuid references sounds(id) on delete cascade,
  note        text,
  created_at  timestamptz default now(),
  unique (user_id, sound_id)
);

alter table user_skill_connections enable row level security;
alter table user_goals             enable row level security;

create policy "user connections owner" on user_skill_connections for all using (auth.uid() = user_id);
create policy "user goals owner"       on user_goals             for all using (auth.uid() = user_id);

alter table sounds            enable row level security;
alter table skill_edges       enable row level security;
alter table reference_clips   enable row level security;
alter table user_progress     enable row level security;
alter table sequences         enable row level security;
alter table sequence_attempts enable row level security;

-- Anyone can read sounds and edges (public curriculum)
create policy "sounds public read"        on sounds           for select using (true);
create policy "edges public read"         on skill_edges      for select using (true);
create policy "references public read"    on reference_clips  for select using (true);

-- Progress: users own their rows
create policy "progress owner"            on user_progress    for all using (auth.uid() = user_id);

-- Sequences: owner full access only
create policy "sequences owner"           on sequences        for all using (auth.uid() = user_id);

-- Attempts: owner only
create policy "attempts owner"            on sequence_attempts for all using (auth.uid() = user_id);

-- Reference clips: only admin can insert
create policy "references admin insert"   on reference_clips  for insert with check (auth.uid() = uploaded_by);
