-- Privilege hardening for a live Cubicle project.
-- Safe to re-run. Does not remove school rows or tables.
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

-- Apply USING / WITH CHECK on an existing policy (looked up by table + polcmd).
-- polcmd: r=select, a=insert, w=update, d=row-removal, *=all
create or replace function public.cubicle_apply_rls(
  p_rel text,
  p_polcmd "char",
  p_using text,
  p_check text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_sql text;
  v_n int := 0;
begin
  for v_name in
    select pol.polname
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = p_rel
      and pol.polcmd = p_polcmd
    order by pol.polname
  loop
    v_n := v_n + 1;
    if p_using is not null and p_check is not null then
      v_sql := format(
        'alter policy %I on public.%I using (%s) with check (%s)',
        v_name, p_rel, p_using, p_check
      );
    elsif p_using is not null then
      v_sql := format(
        'alter policy %I on public.%I using (%s)',
        v_name, p_rel, p_using
      );
    else
      v_sql := format(
        'alter policy %I on public.%I with check (%s)',
        v_name, p_rel, p_check
      );
    end if;
    execute v_sql;
  end loop;

  if v_n = 0 then
    raise exception
      'No matching policy on %. Run schema.sql before this file.',
      p_rel;
  end if;
end;
$$;

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

create or replace trigger protect_profile_privileges
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
  update public.profiles
    set
      role = new.role,
      employment_type = coalesce(new.employment_type, employment_type),
      updated_at = now()
    where lower(email) = lower(new.email);

  return new;
end;
$$;

create or replace trigger sync_profile_from_allowlist
  after insert or update on public.allowed_emails
  for each row execute function public.sync_profile_from_allowlist();

-- ---------------------------------------------------------------------------
-- RLS: allowlist is the access gate; admin = allowlist admin
-- ---------------------------------------------------------------------------
select public.cubicle_apply_rls(
  'profiles',
  'r',
  'public.has_school_access()'
);
select public.cubicle_apply_rls(
  'profiles',
  'w',
  'auth.uid() = id and public.has_school_access()',
  'auth.uid() = id and public.has_school_access()'
);

select public.cubicle_apply_rls(
  'carts',
  'r',
  'public.has_school_access()'
);
select public.cubicle_apply_rls(
  'carts',
  '*',
  'public.is_school_admin()',
  'public.is_school_admin()'
);

select public.cubicle_apply_rls(
  'bookings',
  'r',
  'public.has_school_access()'
);
select public.cubicle_apply_rls(
  'bookings',
  'a',
  null,
  'auth.uid() = teacher_id and public.has_school_access()'
);
select public.cubicle_apply_rls(
  'bookings',
  'w',
  'public.has_school_access() and (auth.uid() = teacher_id or public.is_school_admin())',
  'public.has_school_access() and (auth.uid() = teacher_id or public.is_school_admin())'
);
select public.cubicle_apply_rls(
  'bookings',
  'd',
  'public.has_school_access() and (auth.uid() = teacher_id or public.is_school_admin())'
);

select public.cubicle_apply_rls(
  'issues',
  'r',
  'public.has_school_access()'
);
select public.cubicle_apply_rls(
  'issues',
  'a',
  null,
  'auth.uid() = reported_by_id and public.has_school_access()'
);
select public.cubicle_apply_rls(
  'issues',
  'w',
  'public.has_school_access() and (auth.uid() = reported_by_id or public.is_school_admin())'
);
select public.cubicle_apply_rls(
  'issues',
  'd',
  'public.has_school_access() and (auth.uid() = reported_by_id or public.is_school_admin())'
);

select public.cubicle_apply_rls(
  'slot_restrictions',
  'r',
  'public.has_school_access()'
);
select public.cubicle_apply_rls(
  'slot_restrictions',
  '*',
  'public.is_school_admin()',
  'public.is_school_admin()'
);

select public.cubicle_apply_rls(
  'swap_requests',
  'r',
  'public.has_school_access()'
);
select public.cubicle_apply_rls(
  'swap_requests',
  'a',
  null,
  'auth.uid() = requester_id and public.has_school_access()'
);
select public.cubicle_apply_rls(
  'swap_requests',
  'w',
  'public.has_school_access() and (auth.uid() = requester_id or public.is_school_admin() or exists (select 1 from public.bookings b where b.id = swap_requests.booking_id and b.teacher_id = auth.uid()))',
  'public.has_school_access() and (auth.uid() = requester_id or public.is_school_admin() or exists (select 1 from public.bookings b where b.id = swap_requests.booking_id and b.teacher_id = auth.uid()))'
);

select public.cubicle_apply_rls(
  'booking_policy',
  'r',
  'public.has_school_access()'
);
select public.cubicle_apply_rls(
  'booking_policy',
  'w',
  'public.is_school_admin()',
  'public.is_school_admin()'
);

select public.cubicle_apply_rls(
  'allowed_emails',
  'r',
  'public.is_school_admin()'
);
select public.cubicle_apply_rls(
  'allowed_emails',
  '*',
  'public.is_school_admin()',
  'public.is_school_admin()'
);

notify pgrst, 'reload schema';
