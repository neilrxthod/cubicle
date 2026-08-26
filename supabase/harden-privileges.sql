-- Privilege hardening for a live Cubicle project.
-- Safe to re-run. Does not drop tables or school data.
--
-- Fixes:
-- 1. Profile.role can no longer be self-promoted to admin via the client.
-- 2. Role always follows allowed_emails (allowlist is the source of truth).
-- 3. RLS admin checks use the allowlist, not a writable profile column.
-- 4. Revoked staff (off the allowlist) cannot read or write school data
--    even if they still have a leftover Auth session.

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER so RLS on allowed_emails does not recurse)
-- ---------------------------------------------------------------------------
create or replace function public.has_school_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.allowed_emails ae on ae.email = lower(p.email)
    where p.id = auth.uid()
  );
$$;

create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.allowed_emails ae on ae.email = lower(p.email)
    where p.id = auth.uid()
      and ae.role = 'admin'
  );
$$;

revoke all on function public.has_school_access() from public;
revoke all on function public.is_school_admin() from public;
grant execute on function public.has_school_access() to authenticated;
grant execute on function public.is_school_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Never take role from OAuth user_metadata (client-controlled)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  given_n text;
  family_n text;
  allowed_role text;
begin
  given_n := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'given_name', '')), '');
  family_n := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'family_name', '')), '');

  if given_n is not null or family_n is not null then
    display_name := btrim(concat_ws(' ', given_n, family_n));
  else
    display_name := coalesce(
      nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
      nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    );
  end if;

  select ae.role into allowed_role
  from public.allowed_emails ae
  where ae.email = lower(coalesce(new.email, ''))
  limit 1;

  insert into public.profiles (id, email, name, role, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    display_name,
    coalesce(allowed_role, 'teacher'),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture',
      null
    )
  )
  on conflict (id) do update
    set
      email = excluded.email,
      name = excluded.name,
      role = coalesce(allowed_role, public.profiles.role),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pin profile.role / email / id. Client updates cannot escalate.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_role text;
  allowed_employment text;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.email := old.email;
  end if;

  new.email := lower(btrim(coalesce(new.email, '')));

  select ae.role, ae.employment_type
    into allowed_role, allowed_employment
  from public.allowed_emails ae
  where ae.email = new.email
  limit 1;

  if allowed_role is not null then
    new.role := allowed_role;
  elsif tg_op = 'UPDATE' then
    new.role := old.role;
  else
    new.role := 'teacher';
  end if;

  if allowed_employment is not null then
    new.employment_type := allowed_employment;
  elsif tg_op = 'UPDATE' then
    new.employment_type := old.employment_type;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- Keep profiles in sync when IT changes the allowlist.
create or replace function public.sync_profile_from_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  update public.profiles
    set
      role = new.role,
      employment_type = coalesce(new.employment_type, employment_type),
      updated_at = now()
    where lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists sync_profile_from_allowlist on public.allowed_emails;
create trigger sync_profile_from_allowlist
  after insert or update on public.allowed_emails
  for each row execute function public.sync_profile_from_allowlist();

-- ---------------------------------------------------------------------------
-- RLS: allowlist is the access gate; admin = allowlist admin
-- ---------------------------------------------------------------------------
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (public.has_school_access());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id and public.has_school_access())
  with check (auth.uid() = id and public.has_school_access());

drop policy if exists "Carts are viewable by authenticated users" on public.carts;
create policy "Carts are viewable by authenticated users"
  on public.carts for select
  to authenticated
  using (public.has_school_access());

drop policy if exists "Admins manage carts" on public.carts;
create policy "Admins manage carts"
  on public.carts for all
  to authenticated
  using (public.is_school_admin())
  with check (public.is_school_admin());

drop policy if exists "Bookings are viewable by authenticated users" on public.bookings;
create policy "Bookings are viewable by authenticated users"
  on public.bookings for select
  to authenticated
  using (public.has_school_access());

drop policy if exists "Teachers can create own bookings" on public.bookings;
create policy "Teachers can create own bookings"
  on public.bookings for insert
  to authenticated
  with check (auth.uid() = teacher_id and public.has_school_access());

drop policy if exists "Owners or admins can update bookings" on public.bookings;
create policy "Owners or admins can update bookings"
  on public.bookings for update
  to authenticated
  using (
    public.has_school_access()
    and (auth.uid() = teacher_id or public.is_school_admin())
  )
  with check (
    public.has_school_access()
    and (auth.uid() = teacher_id or public.is_school_admin())
  );

drop policy if exists "Owners or admins can delete bookings" on public.bookings;
create policy "Owners or admins can delete bookings"
  on public.bookings for delete
  to authenticated
  using (
    public.has_school_access()
    and (auth.uid() = teacher_id or public.is_school_admin())
  );

drop policy if exists "Issues are viewable by authenticated users" on public.issues;
create policy "Issues are viewable by authenticated users"
  on public.issues for select
  to authenticated
  using (public.has_school_access());

drop policy if exists "Users can report issues" on public.issues;
create policy "Users can report issues"
  on public.issues for insert
  to authenticated
  with check (auth.uid() = reported_by_id and public.has_school_access());

drop policy if exists "Reporters or admins can update issues" on public.issues;
create policy "Reporters or admins can update issues"
  on public.issues for update
  to authenticated
  using (
    public.has_school_access()
    and (auth.uid() = reported_by_id or public.is_school_admin())
  );

drop policy if exists "Reporters or admins can delete issues" on public.issues;
create policy "Reporters or admins can delete issues"
  on public.issues for delete
  to authenticated
  using (
    public.has_school_access()
    and (auth.uid() = reported_by_id or public.is_school_admin())
  );

drop policy if exists "Restrictions viewable by authenticated users" on public.slot_restrictions;
create policy "Restrictions viewable by authenticated users"
  on public.slot_restrictions for select
  to authenticated
  using (public.has_school_access());

drop policy if exists "Admins manage restrictions" on public.slot_restrictions;
create policy "Admins manage restrictions"
  on public.slot_restrictions for all
  to authenticated
  using (public.is_school_admin())
  with check (public.is_school_admin());

drop policy if exists "Swap requests viewable by authenticated users" on public.swap_requests;
create policy "Swap requests viewable by authenticated users"
  on public.swap_requests for select
  to authenticated
  using (public.has_school_access());

drop policy if exists "Users can create swap requests" on public.swap_requests;
create policy "Users can create swap requests"
  on public.swap_requests for insert
  to authenticated
  with check (auth.uid() = requester_id and public.has_school_access());

drop policy if exists "Requester or admin can update swaps" on public.swap_requests;
drop policy if exists "Owner requester or admin can update swaps" on public.swap_requests;
create policy "Owner requester or admin can update swaps"
  on public.swap_requests for update
  to authenticated
  using (
    public.has_school_access()
    and (
      auth.uid() = requester_id
      or public.is_school_admin()
      or exists (
        select 1 from public.bookings b
        where b.id = swap_requests.booking_id
          and b.teacher_id = auth.uid()
      )
    )
  )
  with check (
    public.has_school_access()
    and (
      auth.uid() = requester_id
      or public.is_school_admin()
      or exists (
        select 1 from public.bookings b
        where b.id = swap_requests.booking_id
          and b.teacher_id = auth.uid()
      )
    )
  );

drop policy if exists "Policy viewable by authenticated users" on public.booking_policy;
create policy "Policy viewable by authenticated users"
  on public.booking_policy for select
  to authenticated
  using (public.has_school_access());

drop policy if exists "Admins update policy" on public.booking_policy;
create policy "Admins update policy"
  on public.booking_policy for update
  to authenticated
  using (public.is_school_admin())
  with check (public.is_school_admin());

drop policy if exists "Admins can read allowlist" on public.allowed_emails;
create policy "Admins can read allowlist"
  on public.allowed_emails for select
  to authenticated
  using (public.is_school_admin());

drop policy if exists "Admins can manage allowlist" on public.allowed_emails;
create policy "Admins can manage allowlist"
  on public.allowed_emails for all
  to authenticated
  using (public.is_school_admin())
  with check (public.is_school_admin());

notify pgrst, 'reload schema';
