-- Idempotent: email notification preference columns on profiles.
-- Safe to run on production if an older schema is missing them.
-- New projects already have these in schema.sql.

alter table public.profiles
  add column if not exists notify_email boolean not null default true;

alter table public.profiles
  add column if not exists notify_issues boolean not null default true;
