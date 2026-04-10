alter table profiles add column if not exists subscription_status text default 'free';
alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists stripe_subscription_id text;
