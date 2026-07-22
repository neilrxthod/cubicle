-- Permanent vs substitute / temporary staff + blue-tick eligibility.
-- Run in Supabase SQL Editor after allowed-emails.sql.
--
-- permanent  → verified blue tick (full-time school staff)
-- substitute → cover / sub, no tick
-- temporary  → short-term contract, no tick

-- ---------------------------------------------------------------------------
-- Allowlist (source of truth for access + employment category)
-- ---------------------------------------------------------------------------
alter table public.allowed_emails
  add column if not exists employment_type text not null default 'permanent';

alter table public.allowed_emails
  drop constraint if exists allowed_emails_employment_type_check;

alter table public.allowed_emails
  add constraint allowed_emails_employment_type_check
  check (employment_type in ('permanent', 'substitute', 'temporary'));

-- Existing rows already default to permanent.

-- ---------------------------------------------------------------------------
-- Profiles (optional cache for UI when profile is loaded without allowlist join)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists employment_type text not null default 'permanent';

alter table public.profiles
  drop constraint if exists profiles_employment_type_check;

alter table public.profiles
  add constraint profiles_employment_type_check
  check (employment_type in ('permanent', 'substitute', 'temporary'));

-- Keep profile employment_type in sync when allowlist role/name is applied on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_role text;
  allowed_name text;
  allowed_employment text;
begin
  select a.role, a.name, a.employment_type
  into allowed_role, allowed_name, allowed_employment
  from public.allowed_emails a
  where a.email = lower(trim(coalesce(new.email, '')))
  limit 1;

  insert into public.profiles (id, email, name, role, employment_type)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      allowed_name,
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    coalesce(allowed_role, new.raw_user_meta_data ->> 'role', 'teacher'),
    coalesce(allowed_employment, 'permanent')
  );
  return new;
end;
$$;

comment on column public.allowed_emails.employment_type is
  'permanent = blue verified tick; substitute/temporary = no tick';
comment on column public.profiles.employment_type is
  'Mirrors allowlist employment category for permanent staff verification';
