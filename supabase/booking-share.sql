-- Share / borrow: second staff on a booking (co-user on the cart slot).
-- Symptom if missing: share picker saves without partner, or schema-cache errors.
--
-- Supabase → SQL Editor → Run. Safe to re-run.

alter table public.bookings
  add column if not exists shared_with_id uuid references public.profiles (id) on delete set null,
  add column if not exists shared_with_name text,
  add column if not exists shared_with_avatar_url text;

comment on column public.bookings.shared_with_id is
  'Optional co-teacher sharing/borrowing this cart for the slot.';
comment on column public.bookings.shared_with_name is
  'Denormalized display name for board avatars.';
comment on column public.bookings.shared_with_avatar_url is
  'Denormalized avatar URL for board dual-PFP display.';

create index if not exists bookings_shared_with_idx
  on public.bookings (shared_with_id)
  where shared_with_id is not null;

notify pgrst, 'reload schema';
