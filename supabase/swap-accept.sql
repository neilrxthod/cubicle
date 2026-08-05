-- Atomic cart swap accept / decline (security definer) + hard guards.
-- Run in: Supabase Dashboard → SQL Editor → paste → Run
-- Safe to re-run.
--
-- Model:
--   • Same calendar day; requester may pick which of their carts to offer.
--   • offered_booking_id set → exchange that booking; null → one-way handoff.
--   • Accept only via accept_swap_request (cannot mark accepted with a raw UPDATE).
--   • Decline / cancel via decline_swap_request with role checks.

-- ---------------------------------------------------------------------------
-- Offered cart column (requester selects which booking to exchange)
-- ---------------------------------------------------------------------------
alter table public.swap_requests
  add column if not exists offered_booking_id uuid references public.bookings (id) on delete set null;

-- ---------------------------------------------------------------------------
-- At most one pending request per (booking, requester)
-- ---------------------------------------------------------------------------
create unique index if not exists swap_requests_pending_unique
  on public.swap_requests (booking_id, requester_id)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS: owner / requester / admin may update rows, but accept is RPC-only
-- ---------------------------------------------------------------------------
drop policy if exists "Requester or admin can update swaps" on public.swap_requests;
drop policy if exists "Owner requester or admin can update swaps" on public.swap_requests;

create policy "Owner requester or admin can update swaps"
  on public.swap_requests for update
  to authenticated
  using (
    auth.uid() = requester_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
    or exists (
      select 1 from public.bookings b
      where b.id = swap_requests.booking_id
        and b.teacher_id = auth.uid()
    )
  )
  with check (
    auth.uid() = requester_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
    or exists (
      select 1 from public.bookings b
      where b.id = swap_requests.booking_id
        and b.teacher_id = auth.uid()
    )
  );

-- Block marking status = accepted outside accept_swap_request.
create or replace function public.swap_requests_status_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status then
    if old.status is distinct from 'pending' then
      raise exception 'Request is already closed';
    end if;

    if new.status = 'accepted' then
      if current_setting('cubicle.swap_accept', true) is distinct from '1' then
        raise exception 'Accept only through accept_swap_request';
      end if;
    elsif new.status is distinct from 'declined' then
      raise exception 'Invalid swap status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists swap_requests_status_guard on public.swap_requests;
create trigger swap_requests_status_guard
  before update on public.swap_requests
  for each row
  execute function public.swap_requests_status_guard();

-- ---------------------------------------------------------------------------
-- accept_swap_request
-- ---------------------------------------------------------------------------
create or replace function public.accept_swap_request(
  p_request_id uuid,
  p_editor_id uuid default null,
  p_editor_name text default null,
  p_editor_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.swap_requests%rowtype;
  v_target public.bookings%rowtype;
  v_source public.bookings%rowtype;
  v_source_id uuid;
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_editor_id uuid;
  v_editor_name text;
  v_editor_avatar text;
  v_edited_at timestamptz := now();
  v_has_last_edited boolean;
  v_cart_status text;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  -- Serialize concurrent accepts on the same request.
  select * into v_req
  from public.swap_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_req.status is distinct from 'pending' then
    raise exception 'Request is not pending';
  end if;

  select * into v_target
  from public.bookings
  where id = v_req.booking_id
  for update;

  if not found then
    raise exception 'Booking missing';
  end if;

  select exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'admin'
  ) into v_is_admin;

  if not v_is_admin and v_target.teacher_id is distinct from v_uid then
    raise exception 'Only the owner can accept';
  end if;

  if v_req.requester_id is not distinct from v_target.teacher_id then
    raise exception 'Requester already owns this slot';
  end if;

  -- Past dates: teachers cannot complete; admin may for cleanup.
  if v_target.date < (timezone('utc', now()))::date and not v_is_admin then
    raise exception 'Cannot accept swaps for past dates';
  end if;

  select c.status into v_cart_status
  from public.carts c
  where c.id = v_target.cart_id;

  if v_cart_status = 'maintenance' and not v_is_admin then
    raise exception 'Cart is in maintenance';
  end if;

  v_editor_id := coalesce(p_editor_id, v_uid);
  v_editor_name := coalesce(
    nullif(btrim(coalesce(p_editor_name, '')), ''),
    (select name from public.profiles where id = v_uid),
    'Staff'
  );
  v_editor_avatar := p_editor_avatar_url;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'last_edited_by_id'
  ) into v_has_last_edited;

  -- Prefer explicitly offered booking (requester selected cart in the UI).
  -- Fall back to same day + period for legacy rows without offered_booking_id.
  if v_req.offered_booking_id is not null then
    select b.id into v_source_id
    from public.bookings b
    where b.id = v_req.offered_booking_id
      and b.teacher_id = v_req.requester_id
      and b.id is distinct from v_target.id;
  else
    select b.id into v_source_id
    from public.bookings b
    where b.teacher_id = v_req.requester_id
      and b.date = v_target.date
      and b.period = v_target.period
      and b.id is distinct from v_target.id
    order by b.created_at asc
    limit 1;
  end if;

  if v_source_id is not null then
    select * into v_source
    from public.bookings
    where id = v_source_id
    for update;

    -- Exchange: each teacher keeps class/subject/notes; cart cells swap people.
    if v_has_last_edited then
      update public.bookings set
        teacher_id = v_source.teacher_id,
        teacher_name = v_source.teacher_name,
        class_name = v_source.class_name,
        subject = v_source.subject,
        notes = v_source.notes,
        last_edited_by_id = v_editor_id,
        last_edited_by_name = v_editor_name,
        last_edited_by_avatar_url = v_editor_avatar,
        last_edited_at = v_edited_at
      where id = v_target.id;

      update public.bookings set
        teacher_id = v_target.teacher_id,
        teacher_name = v_target.teacher_name,
        class_name = v_target.class_name,
        subject = v_target.subject,
        notes = v_target.notes,
        last_edited_by_id = v_editor_id,
        last_edited_by_name = v_editor_name,
        last_edited_by_avatar_url = v_editor_avatar,
        last_edited_at = v_edited_at
      where id = v_source.id;
    else
      update public.bookings set
        teacher_id = v_source.teacher_id,
        teacher_name = v_source.teacher_name,
        class_name = v_source.class_name,
        subject = v_source.subject,
        notes = v_source.notes
      where id = v_target.id;

      update public.bookings set
        teacher_id = v_target.teacher_id,
        teacher_name = v_target.teacher_name,
        class_name = v_target.class_name,
        subject = v_target.subject,
        notes = v_target.notes
      where id = v_source.id;
    end if;
  else
    -- Handoff: requester has no cart this period — transfer this slot only.
    if v_has_last_edited then
      update public.bookings set
        teacher_id = v_req.requester_id,
        teacher_name = v_req.requester_name,
        last_edited_by_id = v_editor_id,
        last_edited_by_name = v_editor_name,
        last_edited_by_avatar_url = v_editor_avatar,
        last_edited_at = v_edited_at
      where id = v_target.id;
    else
      update public.bookings set
        teacher_id = v_req.requester_id,
        teacher_name = v_req.requester_name
      where id = v_target.id;
    end if;
  end if;

  perform set_config('cubicle.swap_accept', '1', true);

  update public.swap_requests
  set status = 'accepted'
  where id = p_request_id;

  -- Close every other pending request that targeted either exchanged booking.
  update public.swap_requests
  set status = 'declined'
  where status = 'pending'
    and id is distinct from p_request_id
    and (
      booking_id = v_target.id
      or (v_source_id is not null and booking_id = v_source_id)
    );
end;
$$;

revoke all on function public.accept_swap_request(uuid, uuid, text, text) from public;
grant execute on function public.accept_swap_request(uuid, uuid, text, text) to authenticated;
grant execute on function public.accept_swap_request(uuid, uuid, text, text) to service_role;

comment on function public.accept_swap_request(uuid, uuid, text, text) is
  'Accept a pending cart swap: exchange the target booking with swap_requests.offered_booking_id (or legacy same-period counterparty), or one-way handoff when none. Accept cannot be faked via raw UPDATE.';

-- ---------------------------------------------------------------------------
-- decline_swap_request — owner/admin reject or requester cancel
-- ---------------------------------------------------------------------------
create or replace function public.decline_swap_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.swap_requests%rowtype;
  v_owner uuid;
  v_uid uuid := auth.uid();
  v_is_admin boolean;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  select * into v_req
  from public.swap_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_req.status is distinct from 'pending' then
    raise exception 'Request is not pending';
  end if;

  select b.teacher_id into v_owner
  from public.bookings b
  where b.id = v_req.booking_id;

  select exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'admin'
  ) into v_is_admin;

  -- Owner / admin reject, or requester cancels their own request.
  if not v_is_admin
     and v_uid is distinct from v_req.requester_id
     and (v_owner is null or v_uid is distinct from v_owner) then
    raise exception 'Not allowed to decline this request';
  end if;

  update public.swap_requests
  set status = 'declined'
  where id = p_request_id;
end;
$$;

revoke all on function public.decline_swap_request(uuid) from public;
grant execute on function public.decline_swap_request(uuid) to authenticated;
grant execute on function public.decline_swap_request(uuid) to service_role;

comment on function public.decline_swap_request(uuid) is
  'Decline or cancel a pending swap: booking owner / admin reject, or requester withdraws.';
