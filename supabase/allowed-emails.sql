-- Allowlist: only these emails may use Google sign-in on Cubicle.
-- Run in Supabase SQL Editor after schema.sql.
--
-- Workflow:
-- 1. Insert school staff emails below (or via Table Editor → allowed_emails)
-- 2. User signs in with Google
-- 3. App checks this table; if email is missing → sign out + delete auth user

create table if not exists public.allowed_emails (
  email text primary key,
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  name text,
  notes text,
  created_at timestamptz not null default now(),
  -- Only Regina board school Google accounts
  constraint allowed_emails_school_domain_check
    check (lower(email) ~* '^[a-z0-9._%+\-]+@rbe\.sk\.ca$')
);

-- Normalize emails to lowercase on write
create or replace function public.normalize_allowed_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists allowed_emails_normalize on public.allowed_emails;
create trigger allowed_emails_normalize
  before insert or update on public.allowed_emails
  for each row execute function public.normalize_allowed_email();

alter table public.allowed_emails enable row level security;

-- Only admins manage the list (service role / dashboard bypasses RLS for setup)
drop policy if exists "Admins can read allowlist" on public.allowed_emails;
create policy "Admins can read allowlist"
  on public.allowed_emails for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can manage allowlist" on public.allowed_emails;
create policy "Admins can manage allowlist"
  on public.allowed_emails for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Server-side helper (security definer) — used by app via service role or RPC
create or replace function public.is_email_allowed(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_emails a
    where a.email = lower(trim(check_email))
  );
$$;

revoke all on function public.is_email_allowed(text) from public;
grant execute on function public.is_email_allowed(text) to service_role;
grant execute on function public.is_email_allowed(text) to authenticated;

create or replace function public.get_allowed_email_role(check_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.role
  from public.allowed_emails a
  where a.email = lower(trim(check_email))
  limit 1;
$$;

revoke all on function public.get_allowed_email_role(text) from public;
grant execute on function public.get_allowed_email_role(text) to service_role;

-- When a profile is created, prefer role/name from the allowlist
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_role text;
  allowed_name text;
begin
  select a.role, a.name
  into allowed_role, allowed_name
  from public.allowed_emails a
  where a.email = lower(trim(coalesce(new.email, '')))
  limit 1;

  -- Still create profile for allowlisted users; unauthorized users are
  -- removed in the app callback. Role defaults to teacher if somehow missing.
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      allowed_name,
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    coalesce(allowed_role, new.raw_user_meta_data ->> 'role', 'teacher')
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed: replace with real @rbe.sk.ca staff (Gmail will be rejected by constraint)
-- ---------------------------------------------------------------------------
-- insert into public.allowed_emails (email, role, name) values
--   ('first.last@rbe.sk.ca', 'admin', 'Your Name'),
--   ('teacher.name@rbe.sk.ca', 'teacher', 'Teacher Name')
-- on conflict (email) do nothing;
