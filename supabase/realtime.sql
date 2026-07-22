-- Enable Supabase Realtime for Cubicle tables.
-- Run once in: Dashboard → SQL Editor → New query → Run
--
-- After this, all signed-in clients receive live INSERT/UPDATE/DELETE events
-- so boards and lists update without a manual refresh.

-- Add tables to the realtime publication (ignore if already present)
do $$
begin
  begin
    alter publication supabase_realtime add table public.bookings;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.carts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.issues;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.slot_restrictions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.swap_requests;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.booking_policy;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.allowed_emails;
  exception when duplicate_object then null;
  end;
end $$;

-- Replica identity FULL helps clients receive complete row payloads on UPDATE/DELETE
alter table public.bookings replica identity full;
alter table public.carts replica identity full;
alter table public.issues replica identity full;
alter table public.slot_restrictions replica identity full;
alter table public.swap_requests replica identity full;
alter table public.profiles replica identity full;
alter table public.booking_policy replica identity full;
alter table public.allowed_emails replica identity full;
