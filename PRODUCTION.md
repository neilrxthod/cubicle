# Cubicle — production readiness

School staff app for **mycubicle.app**. Not a public consumer product.

## Data durability (non-negotiable)

**Code deploys never wipe school data.**

| Layer | Holds | On `git push` / Vercel redeploy |
|-------|--------|----------------------------------|
| **Supabase Postgres** | Bookings, carts, issues, staff, restrictions, profiles | **Unchanged** |
| **Vercel** | Next.js UI + API only | Replaced with new build |
| **Browser** | Session + temporary cache | Not the source of truth |

Full write-up: [`supabase/DATA_DURABILITY.md`](./supabase/DATA_DURABILITY.md)

### Production env (required so data stays on Postgres)

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# Optional extra lock — refuses demo/local mode on this deploy
NEXT_PUBLIC_CUBICLE_REQUIRE_REMOTE=true
```

Without Supabase keys, production hosts (`mycubicle.app`, `*.vercel.app`) **hard-stop** with “Database not connected” instead of showing empty seed data.

### Never do this on a live school project

- Point Vercel at a **new empty** Supabase project (looks like “all data gone”)
- Run `drop table` / `truncate` in SQL Editor
- Enable `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` on Vercel Production

## Access model (non-negotiable)

1. Only `@rbe.sk.ca` Google accounts may sign in.
2. Exact email must exist in Supabase `allowed_emails`.
3. Role (`teacher` | `admin`) and employment type come from allowlist / profile.
4. Gmail and all other domains are rejected in the auth callback.
5. Demo login is **off** unless `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` (never set on Vercel production).

## Vercel environment variables (exact names)

| Name | Public? | Notes |
|------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Server only — allowlist checks / delete unauthorized users |

- Spell **SUPABASE** correctly (not `SUBASE`).
- Never prefix service role with `NEXT_PUBLIC_`.
- After any `NEXT_PUBLIC_*` change → **Redeploy**.
- Do **not** set `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` in production.

Copy from `.env.local.example`.

## Supabase SQL (run in order if not already applied)

| # | File | Purpose |
|---|------|---------|
| 1 | `supabase/schema.sql` | Tables, RLS, profile trigger |
| 2 | `supabase/allowed-emails.sql` | Allowlist + admin policies |
| 3 | `supabase/seed-carts.sql` | Laptop carts |
| 4 | `supabase/restrict-domain.sql` | DB enforces `@rbe.sk.ca` |
| 5 | `supabase/realtime.sql` | Live multi-user board updates |
| 6 | `supabase/employment-type.sql` | Permanent / sub / temp + blue tick |

Then seed real staff:

```sql
insert into public.allowed_emails (email, role, name, employment_type) values
  ('your.name@rbe.sk.ca', 'admin', 'Your Name', 'permanent')
on conflict (email) do update
  set role = excluded.role,
      name = excluded.name,
      employment_type = excluded.employment_type;
```

## Auth URL configuration

### Supabase → Authentication → URL configuration

- **Site URL:** `https://mycubicle.app`
- **Redirect URLs** (all needed):
  - `https://mycubicle.app/auth/callback`
  - `https://www.mycubicle.app/auth/callback`
  - `http://localhost:3000/auth/callback` (dev only)

### Supabase → Authentication → Providers → Google

- Enabled
- Client ID + Client Secret from Google Cloud
- Hosted domain hint: `rbe.sk.ca` (app still enforces domain + allowlist)

### Google Cloud OAuth (Web client)

- Authorized JavaScript origins:
  - `https://mycubicle.app`
  - `https://www.mycubicle.app`
  - `http://localhost:3000`
- Authorized redirect URI (exact):
  - `https://<project-ref>.supabase.co/auth/v1/callback`
- If app is **External + Testing**, add every staff Google account as Test users until published.

### Google Calendar API (Settings → Connect)

- Enable **Google Calendar API** on the OAuth Cloud project
- Consent scope: `https://www.googleapis.com/auth/calendar.events`
- Prefer **Internal** OAuth app under board Workspace for staff-only use
- Teachers connect once in **Settings**; new bookings auto-create events when auto-sync is on
- Fallback: **Add to Calendar** links work without API access

## DNS (name.com → Vercel)

Use the values shown in **Vercel → Project → Domains** (they can change):

- Apex `A` record → Vercel IP
- `www` `CNAME` → Vercel target

SSL is issued by Vercel (no separate name.com cert).

## Pre-deploy verification

```bash
npm ci
npm run build
```

Build must exit 0. Proxy (session refresh) should appear in the build output.

## Smoke test (production)

- [ ] `https://mycubicle.app` loads over HTTPS
- [ ] `/login` is Google-only (no demo account picker)
- [ ] Allowlisted `@rbe.sk.ca` signs in and lands on Schedule or Admin
- [ ] Non-allowlisted `@rbe.sk.ca` blocked (`not_allowed`)
- [ ] Gmail blocked (`invalid_domain`)
- [ ] Book a cart — booking persists after refresh
- [ ] Two browsers: Teacher A books → Teacher B board updates (realtime.sql)
- [ ] Admin → Inventory / Reservations / Reports / Staff / Restrictions
- [ ] Staff: add allowlist email; permanent shows blue tick
- [ ] Restrictions: lock / unlock slots; booked cells not cancelable there
- [ ] Settings: profile photo/name save; Google Calendar section; shortcuts (bookings / admin / sign out)
- [ ] Sign out works
- [ ] `/legal/*` pages load
- [ ] `/signup` redirects to login

## Security checklist

- [ ] GitHub repo **private**
- [ ] `.env.local` never committed
- [ ] Service role key never public / never `NEXT_PUBLIC_`
- [ ] Rotate service role if it was ever leaked
- [ ] Vercel production env only (no demo login flag)
- [ ] Security headers enabled via `next.config.ts` (HSTS, frame deny, nosniff)
- [ ] `robots.txt` disallows indexing; metadata `robots: noindex`

## Post-deploy ops

1. Prefer **Admin → Staff** to manage allowlist (not only SQL).
2. Mark permanent vs substitute / temporary for blue-tick accuracy.
3. Use **Restrictions** for AP / full-day locks; use **Reservations** for booking ops.
4. Keep Google OAuth app verification status in mind for new test users.

## If something fails

| Symptom | Likely fix |
|---------|------------|
| “Google sign-in is not configured” | Missing `NEXT_PUBLIC_SUPABASE_*` on Vercel + redeploy |
| Everyone blocked | Empty allowlist or wrong domain constraint |
| Allowlist works but no blue tick | Run `employment-type.sql` |
| Board never updates live | Run `realtime.sql` + confirm Realtime enabled |
| Redirect loop / auth_failed | Redirect URL mismatch Google ↔ Supabase ↔ Site URL |
| Double booking still possible | Unique index on bookings must exist (`schema.sql`) |
