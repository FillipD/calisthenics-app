create table profiles (
  id text primary key,
  email text,
  goal text,
  level text,
  created_at timestamp default now()
);

create table weekly_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text references profiles(id),
  week_number integer,
  day_label text,
  exercise_name text,
  sets_completed integer,
  reps_completed text,
  created_at timestamp default now()
);

create table user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id text references profiles(id),
  skill_name text,
  current_progression text,
  created_at timestamp default now()
);
