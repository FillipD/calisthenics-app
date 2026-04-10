alter table profiles add column if not exists days_per_week integer default 3;
alter table profiles add column if not exists equipment text[] default array[]::text[];
