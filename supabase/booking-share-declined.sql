-- Share invite declined notice — owner sees who declined until dismissed.
-- Supabase → SQL Editor → Run. Safe to re-run.

alter table public.bookings
  add column if not exists share_declined_by_id uuid references public.profiles (id) on delete set null,
  add column if not exists share_declined_by_name text,
  add column if not exists share_declined_by_avatar_url text,
  add column if not exists share_declined_at timestamptz;

comment on column public.bookings.share_declined_by_id is
  'Invitee who declined a share invite; notice for booking owner until dismissed.';

create index if not exists bookings_share_declined_by_idx
  on public.bookings (share_declined_by_id)
  where share_declined_by_id is not null;

notify pgrst, 'reload schema';
