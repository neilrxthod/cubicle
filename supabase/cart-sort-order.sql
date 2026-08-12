-- Admin drag-and-drop order for schedule / inventory cart rows.
-- Safe to re-run.

alter table public.carts
  add column if not exists sort_order integer;

-- Seed existing rows alphabetically if null.
with ranked as (
  select id, row_number() over (order by name) - 1 as rn
  from public.carts
  where sort_order is null
)
update public.carts c
set sort_order = ranked.rn
from ranked
where c.id = ranked.id;

comment on column public.carts.sort_order is
  'Board / inventory display order (admin drag-and-drop). Lower = higher on the schedule.';
