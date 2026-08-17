-- Extra lock types for admin Block (testing, holiday, event, PD).
-- Run in Supabase SQL Editor after schema.sql.

alter table public.slot_restrictions
  drop constraint if exists slot_restrictions_category_check;

alter table public.slot_restrictions
  add constraint slot_restrictions_category_check
  check (category in (
    'general',
    'ap_exam',
    'testing',
    'holiday',
    'event',
    'pd',
    'other'
  ));
