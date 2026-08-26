-- Additive only. Does not drop tables, delete rows, or revoke table grants.
-- Adds an INSERT policy so allowlisted staff can upsert their own profiles row.
-- Safe to re-run.
--
-- Dashboard → SQL Editor → paste → Run.

create or replace function public.email_on_allowlist(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_emails ae
    where ae.email = lower(btrim(coalesce(p_email, '')))
  );
$$;

grant execute on function public.email_on_allowlist(text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Allowlisted users insert own profile'
  ) then
    create policy "Allowlisted users insert own profile"
      on public.profiles
      for insert
      to authenticated
      with check (
        auth.uid() = id
        and public.email_on_allowlist(email)
      );
  end if;
end
$$;

notify pgrst, 'reload schema';
