-- Cart inventory seed — intentionally empty.
-- Platform starts with no carts; add them via Admin → Inventory.
--
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
