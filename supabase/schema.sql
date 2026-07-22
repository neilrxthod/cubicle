-- Cubicle starter schema for Supabase (Postgres)
-- Run in: Dashboard → SQL Editor → New query → paste → Run
-- Safe to re-run: uses IF NOT EXISTS where possible.

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  title text,
  department text,
  phone text,
  bio text,
  avatar_url text,
  notify_email boolean not null default true,
  notify_issues boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Carts
-- ---------------------------------------------------------------------------
create table if not exists public.carts (
  id text primary key,
  name text not null,
  status text not null default 'active' check (status in ('active', 'maintenance')),
  laptop_count integer,
  location text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  cart_id text not null references public.carts (id) on delete cascade,
  date date not null,
  period text not null check (period in ('P1', 'P2', 'P3', 'P4', 'P5')),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  teacher_name text not null,
  class_name text,
  subject text,
  notes text,
  created_at timestamptz not null default now(),
  unique (cart_id, date, period)
);

create index if not exists bookings_date_idx on public.bookings (date);
create index if not exists bookings_teacher_idx on public.bookings (teacher_id);

-- ---------------------------------------------------------------------------
-- Issues
-- ---------------------------------------------------------------------------
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  cart_id text not null references public.carts (id) on delete cascade,
  description text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  reported_by_id uuid not null references public.profiles (id) on delete cascade,
  reporter_name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Slot restrictions
-- ---------------------------------------------------------------------------
create table if not exists public.slot_restrictions (
  id uuid primary key default gen_random_uuid(),
  cart_id text not null references public.carts (id) on delete cascade,
  date date not null,
  period text not null check (period in ('P1', 'P2', 'P3', 'P4', 'P5')),
  category text not null check (category in ('ap_exam', 'general', 'other')),
  reason text,
  unique (cart_id, date, period)
);

-- ---------------------------------------------------------------------------
-- Swap requests
-- ---------------------------------------------------------------------------
create table if not exists public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  requester_name text not null,
  reason text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Booking policy (single-row settings)
-- ---------------------------------------------------------------------------
create table if not exists public.booking_policy (
  id integer primary key default 1 check (id = 1),
  max_advance_days integer not null default 14
);

insert into public.booking_policy (id, max_advance_days)
values (1, 14)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Auto-create profile when a user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'teacher')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.carts enable row level security;
alter table public.bookings enable row level security;
alter table public.issues enable row level security;
alter table public.slot_restrictions enable row level security;
alter table public.swap_requests enable row level security;
alter table public.booking_policy enable row level security;

-- Profiles: users read all (for names on board); update own row
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Carts: everyone authenticated can read; only admins write
drop policy if exists "Carts are viewable by authenticated users" on public.carts;
create policy "Carts are viewable by authenticated users"
  on public.carts for select
  to authenticated
  using (true);

drop policy if exists "Admins manage carts" on public.carts;
create policy "Admins manage carts"
  on public.carts for all
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

-- Bookings: all can read; teachers insert own; owner or admin update/delete
drop policy if exists "Bookings are viewable by authenticated users" on public.bookings;
create policy "Bookings are viewable by authenticated users"
  on public.bookings for select
  to authenticated
  using (true);

drop policy if exists "Teachers can create own bookings" on public.bookings;
create policy "Teachers can create own bookings"
  on public.bookings for insert
  to authenticated
  with check (auth.uid() = teacher_id);

drop policy if exists "Owners or admins can update bookings" on public.bookings;
create policy "Owners or admins can update bookings"
  on public.bookings for update
  to authenticated
  using (
    auth.uid() = teacher_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Owners or admins can delete bookings" on public.bookings;
create policy "Owners or admins can delete bookings"
  on public.bookings for delete
  to authenticated
  using (
    auth.uid() = teacher_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Issues
drop policy if exists "Issues are viewable by authenticated users" on public.issues;
create policy "Issues are viewable by authenticated users"
  on public.issues for select
  to authenticated
  using (true);

drop policy if exists "Users can report issues" on public.issues;
create policy "Users can report issues"
  on public.issues for insert
  to authenticated
  with check (auth.uid() = reported_by_id);

drop policy if exists "Reporters or admins can update issues" on public.issues;
create policy "Reporters or admins can update issues"
  on public.issues for update
  to authenticated
  using (
    auth.uid() = reported_by_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Slot restrictions: all read; admins write
drop policy if exists "Restrictions viewable by authenticated users" on public.slot_restrictions;
create policy "Restrictions viewable by authenticated users"
  on public.slot_restrictions for select
  to authenticated
  using (true);

drop policy if exists "Admins manage restrictions" on public.slot_restrictions;
create policy "Admins manage restrictions"
  on public.slot_restrictions for all
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

-- Swap requests
drop policy if exists "Swap requests viewable by authenticated users" on public.swap_requests;
create policy "Swap requests viewable by authenticated users"
  on public.swap_requests for select
  to authenticated
  using (true);

drop policy if exists "Users can create swap requests" on public.swap_requests;
create policy "Users can create swap requests"
  on public.swap_requests for insert
  to authenticated
  with check (auth.uid() = requester_id);

drop policy if exists "Requester or admin can update swaps" on public.swap_requests;
create policy "Requester or admin can update swaps"
  on public.swap_requests for update
  to authenticated
  using (
    auth.uid() = requester_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Booking policy
drop policy if exists "Policy viewable by authenticated users" on public.booking_policy;
create policy "Policy viewable by authenticated users"
  on public.booking_policy for select
  to authenticated
  using (true);

drop policy if exists "Admins update policy" on public.booking_policy;
create policy "Admins update policy"
  on public.booking_policy for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Seed sample carts (optional — delete if you prefer empty tables)
-- ---------------------------------------------------------------------------
insert into public.carts (id, name, status, laptop_count, location) values
  ('cart-01', 'Oak', 'active', 30, 'Library'),
  ('cart-02', 'Maple', 'active', 28, 'Room 102'),
  ('cart-03', 'Cedar', 'active', 32, 'Room 118'),
  ('cart-04', 'Pine', 'active', 30, 'Room 204'),
  ('cart-05', 'Birch', 'active', 24, 'Room 210'),
  ('cart-06', 'Willow', 'active', 30, 'Room 215'),
  ('cart-07', 'Aspen', 'active', 28, 'Science wing'),
  ('cart-08', 'Redwood', 'active', 32, 'Lab 1'),
  ('cart-09', 'Elm', 'active', 30, 'Lab 2'),
  ('cart-10', 'Spruce', 'maintenance', 26, 'Media center')
on conflict (id) do nothing;
