-- 0001: all the tables for Lexicon
-- run this first in the Supabase SQL Editor

-- the non-speaking person. everything else hangs off this table
create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  about text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- who is allowed to see a person (family, caregivers)
-- "owner" can manage the circle, "caregiver" can add clips and answer asks
create table circle_members (
  person_id uuid not null references people (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'caregiver' check (role in ('owner', 'caregiver')),
  display_name text,
  can_answer boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (person_id, user_id)
);

-- the QR code a stranger scans. short lived and can be revoked
create table access_grants (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  -- gen_random_uuid is built into postgres, so we dont need pgcrypto
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  label text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- one row for every stranger who opened a valid code
-- this is what the security rules actually check (not the token)
create table grant_sessions (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references access_grants (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (grant_id, user_id)
);

-- layer 3: a stranger films something and asks "what is this?"
create table ask_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  grant_id uuid references access_grants (id) on delete set null,
  asker_user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  video_path text,
  mime_type text,
  note text,
  status text not null default 'open' check (status in ('open', 'answered', 'unknown')),
  answer text,
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

-- one clip = one entry in the dictionary
create table signals (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  -- what it looks like, e.g. "rocks and hums low"
  title text not null check (length(trim(title)) > 0),
  -- what it means, e.g. "pain, usually tummy"
  meaning text not null,
  -- what you should do about it
  action text,
  -- where on the body it happens (used by the "point" filter)
  body_region text not null default 'whole_body'
    check (body_region in ('hands', 'face', 'legs', 'whole_body')),
  -- sound is separate from body region, someone can hum while rocking
  has_sound boolean not null default false,
  -- optional link to the FLACC pain scale categories
  flacc_category text
    check (flacc_category in ('face', 'legs', 'activity', 'cry', 'consolability')),
  video_path text not null,
  poster_path text,
  -- whatever the browser really recorded (chrome = webm, safari = mp4)
  mime_type text not null,
  duration_ms integer,
  -- if this signal came from an answered ask, remember which one
  source_ask_id uuid references ask_requests (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- full text search column, postgres keeps it updated for us
  search tsvector generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(meaning, '') || ' ' || coalesce(action, ''))
  ) stored
);

create index signals_search_idx on signals using gin (search);
create index signals_person_idx on signals (person_id);

-- where a circle member's browser can get push notifications
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- every time someone looks. the family can see exactly who looked
-- nobody can insert here directly, only our security definer functions
create table access_log (
  id bigint generated always as identity primary key,
  person_id uuid not null references people (id) on delete cascade,
  grant_id uuid references access_grants (id) on delete set null,
  user_id uuid,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- some indexes for the lookups we do a lot
create index circle_members_user_idx on circle_members (user_id);
create index access_grants_person_idx on access_grants (person_id);
create index grant_sessions_user_idx on grant_sessions (user_id);
create index ask_requests_person_idx on ask_requests (person_id);
create index access_log_person_idx on access_log (person_id, created_at desc);
