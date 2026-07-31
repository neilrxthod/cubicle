-- Attribution: who last created or edited a booking (multi-admin visibility).
-- Run in Supabase SQL Editor if using remote Postgres.

alter table public.bookings
  add column if not exists last_edited_by_id uuid references public.profiles (id) on delete set null,
  add column if not exists last_edited_by_name text,
  add column if not exists last_edited_by_avatar_url text,
  add column if not exists last_edited_at timestamptz;

comment on column public.bookings.last_edited_by_id is
  'User who last created or changed this booking (teacher or admin).';
