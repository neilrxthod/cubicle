-- Max cart slots a teacher may hold on a single school day (P1–P5).
-- Run in Supabase SQL Editor after schema.sql (safe to re-run).

alter table public.booking_policy
  add column if not exists max_slots_per_teacher_per_day integer not null default 5;

-- Keep values in a sensible range (1 period … all 5 periods).
alter table public.booking_policy
  drop constraint if exists booking_policy_max_slots_range;

alter table public.booking_policy
  add constraint booking_policy_max_slots_range
  check (max_slots_per_teacher_per_day >= 1 and max_slots_per_teacher_per_day <= 5);

update public.booking_policy
set max_slots_per_teacher_per_day = 5
where id = 1
  and (max_slots_per_teacher_per_day is null or max_slots_per_teacher_per_day < 1);

insert into public.booking_policy (id, max_advance_days, max_slots_per_teacher_per_day)
values (1, 14, 5)
on conflict (id) do nothing;
