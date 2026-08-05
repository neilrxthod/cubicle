-- Atomic cart swap accept (security definer).
-- Fixes one-sided swaps: when the requester also has a cart for the same
-- date + period, both slots exchange teachers (and class/subject/notes).
-- Also lets the booking owner accept/decline under RLS.
--
-- Run in: Supabase Dashboard → SQL Editor → paste → Run
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- RLS: booking owner (receiver) can accept/decline, not only the requester
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

-- ---------------------------------------------------------------------------
-- accept_swap_request: two-way cart exchange when both teachers have slots
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
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_editor_id uuid;
  v_editor_name text;
  v_editor_avatar text;
  v_edited_at timestamptz := now();
  v_has_last_edited boolean;
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

  -- Requester's booking on the same date + period (true cart swap).
  select * into v_source
  from public.bookings
  where teacher_id = v_req.requester_id
    and date = v_target.date
    and period = v_target.period
    and id is distinct from v_target.id
  for update;

  if found then
    -- Target cart cell ← requester (with their class / subject / notes)
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

      -- Counterparty cart cell ← original owner (with their class / subject / notes)
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
    -- One-way: requester has no cart this period — hand over this slot only.
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

  update public.swap_requests
  set status = 'accepted'
  where id = p_request_id;

  -- Close other pending swaps that pointed at either exchanged booking.
  update public.swap_requests
  set status = 'declined'
  where status = 'pending'
    and id is distinct from p_request_id
    and (
      booking_id = v_target.id
      or (v_source.id is not null and booking_id = v_source.id)
    );
end;
$$;

revoke all on function public.accept_swap_request(uuid, uuid, text, text) from public;
grant execute on function public.accept_swap_request(uuid, uuid, text, text) to authenticated;
grant execute on function public.accept_swap_request(uuid, uuid, text, text) to service_role;

comment on function public.accept_swap_request(uuid, uuid, text, text) is
  'Accept a pending cart swap: exchange both teachers'' slots for the same date/period, or one-way handoff if the requester has no counterparty booking.';
