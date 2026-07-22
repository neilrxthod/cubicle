-- Full 22-cart seed for Cubicle (matches app demo names).
-- Run after schema.sql.
--
-- SAFE TO RE-RUN ON PRODUCTION:
-- - Inserts missing carts only for new ids.
-- - On conflict: updates catalog fields (name, laptop_count, location)
--   but NEVER overwrites operational status (active/maintenance) so a re-seed
--   cannot undo live maintenance flags or admin edits.

insert into public.carts (id, name, status, laptop_count, location) values
  ('cart-01', 'Oak', 'active', 30, 'Library'),
  ('cart-02', 'Maple', 'active', 28, 'Room 102'),
  ('cart-03', 'Cedar', 'active', 32, 'Room 118'),
  ('cart-04', 'Pine', 'active', 30, 'Room 204'),
  ('cart-05', 'Birch', 'active', 24, 'Room 210'),
  ('cart-06', 'Willow', 'active', 30, 'Room 215'),
  ('cart-07', 'Aspen', 'active', 28, 'Science wing'),
  ('cart-08', 'Redwood', 'active', 32, 'Lab 1'),
  ('cart-09', 'Elm', 'active', 30, 'Lab 2'),
  ('cart-10', 'Spruce', 'maintenance', 26, 'Media center'),
  ('cart-11', 'Juniper', 'active', 30, 'Room 301'),
  ('cart-12', 'Cypress', 'active', 28, 'Room 308'),
  ('cart-13', 'Poplar', 'active', 30, 'Room 312'),
  ('cart-14', 'Hickory', 'active', 24, 'Room 320'),
  ('cart-15', 'Sycamore', 'active', 32, 'English wing'),
  ('cart-16', 'Magnolia', 'active', 30, 'Room 405'),
  ('cart-17', 'Laurel', 'active', 28, 'Room 412'),
  ('cart-18', 'Alder', 'active', 30, 'Math wing'),
  ('cart-19', 'Beech', 'active', 26, 'Room 508'),
  ('cart-20', 'Hemlock', 'active', 30, 'Room 514'),
  ('cart-21', 'Fir', 'active', 28, 'IT closet'),
  ('cart-22', 'Yew', 'active', 24, 'Counseling suite')
on conflict (id) do update set
  name = excluded.name,
  laptop_count = excluded.laptop_count,
  location = excluded.location;
  -- status intentionally omitted — preserve live operational state

-- High-severity issues auto-flag the cart for maintenance (works for teachers under RLS)
create or replace function public.on_issue_high_severity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.severity = 'high' and new.status = 'open' then
    update public.carts
    set status = 'maintenance'
    where id = new.cart_id;
  end if;
  return new;
end;
$$;

drop trigger if exists issues_high_severity on public.issues;
create trigger issues_high_severity
  after insert on public.issues
  for each row execute function public.on_issue_high_severity();
