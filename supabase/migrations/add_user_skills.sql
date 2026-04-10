-- user_skills: tracks which skill goals a user is actively working toward
-- goal_node_id is the top-level skill goal (e.g. "full-fl", "strict-mu")
create table if not exists user_skills (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles(id) on delete cascade,
  goal_node_id text not null,
  created_at   timestamp default now(),
  unique(user_id, goal_node_id)
);

-- Index for fast per-user lookups
create index if not exists user_skills_user_id_idx on user_skills(user_id);
