-- Allow reporters and admins to permanently delete issues from Postgres.
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run.

drop policy if exists "Reporters or admins can delete issues" on public.issues;
create policy "Reporters or admins can delete issues"
  on public.issues for delete
  to authenticated
  using (
    auth.uid() = reported_by_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
