-- Wipe operational platform data for a complete fresh start.
-- Does NOT drop schema, policies, or auth users.
-- Run in Supabase SQL Editor only if you intentionally want empty tables.
--
-- Keeps:
--   - allowed_emails (staff allowlist)
--   - profiles (signed-in staff rows)
--   - booking_policy (defaults)
--
-- Clears:
--   - bookings, swap_requests, issues, slot_restrictions, carts

begin;

truncate table public.swap_requests restart identity cascade;
truncate table public.bookings restart identity cascade;
truncate table public.issues restart identity cascade;
truncate table public.slot_restrictions restart identity cascade;
truncate table public.carts restart identity cascade;

-- Ensure booking window exists with a clean default
insert into public.booking_policy (id, max_advance_days)
values (1, 14)
on conflict (id) do update set max_advance_days = 14;

commit;
