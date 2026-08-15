-- Teachers may accept / decline a share invite on someone else's booking.
-- Owners may cancel a pending invite or dismiss a decline notice.
-- Admins may do either.
--
-- Required: the booking is owned by another teacher, so the usual
-- "Owners or admins can update bookings" RLS policy blocks invitees.
-- This function runs as security definer and only mutates share columns.
--
-- Supabase → SQL Editor → Run. Safe to re-run.

alter table public.bookings
  add column if not exists share_declined_by_id uuid references public.profiles (id) on delete set null,
  add column if not exists share_declined_by_name text,
  add column if not exists share_declined_by_avatar_url text,
  add column if not exists share_declined_at timestamptz;

create or replace function public.resolve_share_invite(
  p_booking_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.bookings%rowtype;
  uid uuid := auth.uid();
  is_admin boolean := false;
  actor_name text;
  actor_avatar text;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  if p_action is null or p_action not in ('accept', 'decline', 'cancel', 'dismiss') then
    raise exception 'Invalid share action';
  end if;

  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin'
  ) into is_admin;

  select * into rec
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  select p.name, p.avatar_url
    into actor_name, actor_avatar
  from public.profiles p
  where p.id = uid;

  if p_action = 'accept' then
    if rec.share_pending_id is distinct from uid then
      raise exception 'This share request is not for you.';
    end if;

    update public.bookings
    set
      shared_with_id = uid,
      shared_with_name = coalesce(actor_name, rec.share_pending_name),
      shared_with_avatar_url = coalesce(actor_avatar, rec.share_pending_avatar_url),
      share_pending_id = null,
      share_pending_name = null,
      share_pending_avatar_url = null,
      share_declined_by_id = null,
      share_declined_by_name = null,
      share_declined_by_avatar_url = null,
      share_declined_at = null
    where id = p_booking_id;
    return;
  end if;

  if p_action = 'decline' then
    if rec.share_pending_id is distinct from uid then
      raise exception 'This share request is not for you.';
    end if;

    update public.bookings
    set
      share_pending_id = null,
      share_pending_name = null,
      share_pending_avatar_url = null,
      share_declined_by_id = uid,
      share_declined_by_name = coalesce(actor_name, rec.share_pending_name),
      share_declined_by_avatar_url = coalesce(actor_avatar, rec.share_pending_avatar_url),
      share_declined_at = now()
    where id = p_booking_id;
    return;
  end if;

  if p_action = 'cancel' then
    if rec.teacher_id is distinct from uid and not is_admin then
      raise exception 'Not allowed to cancel this invite.';
    end if;

    update public.bookings
    set
      share_pending_id = null,
      share_pending_name = null,
      share_pending_avatar_url = null,
      share_declined_by_id = null,
      share_declined_by_name = null,
      share_declined_by_avatar_url = null,
      share_declined_at = null
    where id = p_booking_id;
    return;
  end if;

  -- dismiss
  if rec.teacher_id is distinct from uid and not is_admin then
    raise exception 'Not allowed to dismiss this notice.';
  end if;

  update public.bookings
  set
    share_declined_by_id = null,
    share_declined_by_name = null,
    share_declined_by_avatar_url = null,
    share_declined_at = null
  where id = p_booking_id;
end;
$$;

revoke all on function public.resolve_share_invite(uuid, text) from public;
grant execute on function public.resolve_share_invite(uuid, text) to authenticated;
grant execute on function public.resolve_share_invite(uuid, text) to service_role;

comment on function public.resolve_share_invite(uuid, text) is
  'Accept, decline, cancel, or dismiss a cart share invite. Invitees may accept/decline; owners/admins may cancel/dismiss.';

notify pgrst, 'reload schema';
