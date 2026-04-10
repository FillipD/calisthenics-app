create table profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique,                  -- filled in when they sign up with Clerk
  email text unique not null,
  goal text,
  level text,
  created_at timestamp default now()
);

create table weekly_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  week_number integer,
  day_label text,
  exercise_name text,
  sets_completed integer,
  reps_completed text,
  created_at timestamp default now()
);

create table user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  skill_name text,
  current_progression text,
  created_at timestamp default now()
);
