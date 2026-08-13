-- Per-cart laptop case codes for QR labels.
-- Safe to re-run.

alter table public.carts
  add column if not exists laptop_codes text[] not null default '{}';

comment on column public.carts.laptop_codes is
  'Alphanumeric laptop case codes. Each prints as its own QR label.';
