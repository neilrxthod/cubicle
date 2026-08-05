-- Max cart slots a teacher may hold on a single school day (P1–P5).
--
-- REQUIRED for Settings → Booking policy → "Max cart slots per day".
-- Symptom if missing:
--   Could not find the 'max_slots_per_teacher_per_day' column of
--   'booking_policy' in the schema cache
--
-- Fix: Supabase Dashboard → SQL Editor → paste this file → Run.
-- Safe to re-run.

alter table public.booking_policy
  add column if not exists max_slots_per_teacher_per_day integer not null default 5;

-- Keep values in a sensible range (1–15 slots per day).
alter table public.booking_policy
  drop constraint if exists booking_policy_max_slots_range;

alter table public.booking_policy
  add constraint booking_policy_max_slots_range
  check (max_slots_per_teacher_per_day >= 1 and max_slots_per_teacher_per_day <= 15);

-- Ensure the single policy row exists and has a valid default.
insert into public.booking_policy (id, max_advance_days, max_slots_per_teacher_per_day)
values (1, 14, 5)
on conflict (id) do update
  set max_slots_per_teacher_per_day = coalesce(
    public.booking_policy.max_slots_per_teacher_per_day,
    5
  );

-- Reload PostgREST schema cache so the new column is visible immediately.
notify pgrst, 'reload schema';
