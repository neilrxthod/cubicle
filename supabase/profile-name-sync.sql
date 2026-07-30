-- Fan-out profile display name to denormalized columns when name changes.
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Safe to re-run.
--
-- Why: bookings.teacher_name / issues.reporter_name / swap_requests.requester_name
-- are denormalized for fast board reads. When Google OAuth updates profiles.name,
-- this trigger keeps those columns aligned so Realtime clients see First+Last
-- everywhere without a full re-login.

create or replace function public.sync_profile_display_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name and new.name is not null and btrim(new.name) <> '' then
    update public.bookings
      set teacher_name = new.name
      where teacher_id = new.id
        and teacher_name is distinct from new.name;

    update public.issues
      set reporter_name = new.name
      where reported_by_id = new.id
        and reporter_name is distinct from new.name;

    update public.swap_requests
      set requester_name = new.name
      where requester_id = new.id
        and requester_name is distinct from new.name;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_name_changed on public.profiles;
create trigger on_profile_name_changed
  after update of name on public.profiles
  for each row
  execute function public.sync_profile_display_name();

-- Prefer Google given_name + family_name when a new auth user is created.
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

  insert into public.profiles (id, email, name, role, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    display_name,
    coalesce(new.raw_user_meta_data ->> 'role', 'teacher'),
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
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();

  return new;
end;
$$;
