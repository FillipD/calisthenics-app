-- user_progress: tracks per-node status for the skill tree
-- Note: user_id is uuid (not text) to match profiles.id which is uuid
create table user_progress (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  node_id    text not null,
  status     text check (status in ('current', 'completed')),
  created_at timestamp default now(),
  unique(user_id, node_id)
);

-- Index for fast per-user lookups
create index user_progress_user_id_idx on user_progress(user_id);
