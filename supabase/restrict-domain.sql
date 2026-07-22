-- Enforce @rbe.sk.ca only on the allowlist (run in SQL Editor).
-- Safe to re-run.

-- Remove any non-school emails that may have been added during setup
delete from public.allowed_emails
where lower(email) not like '%@rbe.sk.ca';

-- Drop loose check if present, then require exact domain
alter table public.allowed_emails
  drop constraint if exists allowed_emails_school_domain_check;

alter table public.allowed_emails
  add constraint allowed_emails_school_domain_check
  check (lower(email) ~* '^[a-z0-9._%+\-]+@rbe\.sk\.ca$');
