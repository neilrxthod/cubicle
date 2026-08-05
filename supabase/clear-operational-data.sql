-- =============================================================================
-- Official school go-live: clear operational data
-- =============================================================================
-- Run once in Supabase → SQL Editor before the high school starts using Cubicle.
--
-- CLEARS (schedule / fleet):
--   bookings, swap_requests, issues, slot_restrictions, carts
--
-- KEEPS (identity / access):
--   allowed_emails  (staff allowlist — who can sign in)
--   profiles        (staff who already signed in with Google)
--   booking_policy  (reset to 14-day window)
--
-- Does NOT delete auth.users. Re-invite staff only if you also clear allowlist.
-- =============================================================================

begin;

truncate table public.swap_requests restart identity cascade;
truncate table public.bookings restart identity cascade;
truncate table public.issues restart identity cascade;
truncate table public.slot_restrictions restart identity cascade;
truncate table public.carts restart identity cascade;

insert into public.booking_policy (id, max_advance_days)
values (1, 14)
on conflict (id) do update set max_advance_days = 14;

commit;

-- After this: Admin → Inventory → Add cart for each laptop cart.
-- Teachers book from Schedule once carts exist.
