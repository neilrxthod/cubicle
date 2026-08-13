-- Laptop fleet on each inventory cart (Dell or Chromebook).
-- Safe to re-run.

alter table public.carts
  add column if not exists laptop_brand text;

alter table public.carts
  drop constraint if exists carts_laptop_brand_check;

alter table public.carts
  add constraint carts_laptop_brand_check
  check (laptop_brand is null or laptop_brand in ('dell', 'chromebook'));

comment on column public.carts.laptop_brand is
  'Laptop fleet for this cart: dell or chromebook. Set by admins in Inventory.';
