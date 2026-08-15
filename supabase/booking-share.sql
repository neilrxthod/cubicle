-- Share / borrow with permission (friend request).
-- 1) Accepted partner: shared_with_*
-- 2) Pending invite: share_pending_* (invitee must accept)
--
-- Supabase → SQL Editor → Run. Safe to re-run.

alter table public.bookings
  add column if not exists shared_with_id uuid references public.profiles (id) on delete set null,
  add column if not exists shared_with_name text,
  add column if not exists shared_with_avatar_url text,
  add column if not exists share_pending_id uuid references public.profiles (id) on delete set null,
  add column if not exists share_pending_name text,
  add column if not exists share_pending_avatar_url text;

comment on column public.bookings.shared_with_id is
  'Accepted co-teacher on this slot (dual PFP).';
comment on column public.bookings.share_pending_id is
  'Pending share invitee — must accept before shared_with is set.';

create index if not exists bookings_shared_with_idx
  on public.bookings (shared_with_id)
  where shared_with_id is not null;

create index if not exists bookings_share_pending_idx
  on public.bookings (share_pending_id)
  where share_pending_id is not null;

notify pgrst, 'reload schema';

-- Teachers still cannot UPDATE another teacher's booking (RLS).
-- After this file succeeds, run booking-share-resolve.sql so invitees
-- can accept / decline.
