create table user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan jsonb not null,
  week_number integer default 1,
  generated_at timestamp default now(),
  unique(user_id)
);
