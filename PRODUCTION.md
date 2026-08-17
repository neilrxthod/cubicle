# Cubicle — production readiness

School staff app for **mycubicle.app** (live on Vercel). **mycubicle.com** is supported in code once attached in Vercel → Domains. Not a public consumer product.

## Data durability (non-negotiable)

**Code deploys never wipe school data.**

| Layer | Holds | On `git push` / Vercel redeploy |
|-------|--------|----------------------------------|
| **Supabase Postgres** | Bookings, carts, issues, staff, shares, laptop codes, restrictions, profiles | **Unchanged** |
| **Vercel** | Next.js UI + API only | Replaced with new build |
| **Browser** | Session + temporary cache | Not the source of truth |

Full write-up: [`supabase/DATA_DURABILITY.md`](./supabase/DATA_DURABILITY.md)

### Production env (required so data stays on Postgres)

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=          # legacy JWT — accepted if publishable is unset
SUPABASE_SERVICE_ROLE_KEY=
# Optional extra lock — refuses demo/local mode on this deploy
NEXT_PUBLIC_CUBICLE_REQUIRE_REMOTE=true
```

Without Supabase keys, production hosts (`mycubicle.app`, `mycubicle.com`, `*.vercel.app`) **hard-stop** with “Database not connected” instead of showing empty seed data.

### Local development does not write production data

`npm run dev` / localhost keeps carts, bookings, issues, and staff ops in a **local browser sandbox** by default — even when production Supabase keys are in `.env.local`. School staff will not see those experiments.

To use a remote database from your laptop (prefer a **staging** Supabase project):

```text
NEXT_PUBLIC_CUBICLE_USE_REMOTE_IN_DEV=true
```

Do **not** enable that flag with production school keys unless you deliberately want live data on your machine.

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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Preferred public key (`sb_publishable_…`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Legacy JWT — used only if publishable is unset |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Server only — allowlist checks / delete unauthorized users |
| `BREVO_API_KEY` | **No** | Transactional email. Required for production notifications |
| `BREVO_SENDER_EMAIL` | **No** | Verified sender, e.g. `noreply-mail@mycubicle.app` |
| `BREVO_SENDER_NAME` | **No** | Optional display name (default: Cubicle) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical origin, e.g. `https://mycubicle.app` |
| `NEXT_PUBLIC_CUBICLE_REQUIRE_REMOTE` | Yes | Set `true` on Production so the app never falls back to demo |

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
| 5 | `supabase/realtime.sql` | Live multi-user board and presence |
| 6 | `supabase/employment-type.sql` | Permanent / sub / temp + blue tick |
| 7 | `supabase/profile-name-sync.sql` | Display-name fan-out |
| 8 | `supabase/booking-last-editor.sql` | Last-editor metadata on bookings |
| 9 | `supabase/swap-accept.sql` | Atomic two-way cart swap |
| 10 | `supabase/booking-policy-max-slots.sql` | Max cart slots per teacher per day |
| 11 | `supabase/booking-share.sql` | Share / borrow second teacher on a slot |
| 12 | `supabase/booking-share-resolve.sql` | Teachers can accept / decline a share invite |
| 13 | `supabase/booking-share-declined.sql` | Owner notice when an invitee declines |
| 14 | `supabase/cart-laptop-brand.sql` | Dell / Chromebook fleet on inventory carts |
| 15 | `supabase/cart-laptop-codes.sql` | Per-cart laptop case codes for QR labels |
| 16 | `supabase/cart-sort-order.sql` | Admin drag-and-drop cart order |
| 17 | `supabase/issues-delete.sql` | Reporter / admin issue delete |
| 18 | `supabase/notify-email.sql` | Profile email notification toggles (idempotent) |

If an existing project skipped later files, run **`supabase/repair-live.sql` once**.

**If Settings → Booking policy shows a schema-cache error about `max_slots_per_teacher_per_day`:** run file **10** in the Supabase SQL Editor, then save again.

**If share/borrow fails or dual avatars never save:** run file **11** (`booking-share.sql`).

**If teachers cannot accept a share invite:** run file **12** (`booking-share-resolve.sql`). Invitees are not the booking owner, so they cannot write the row until that function exists.

**If Dell / Chromebook logos never appear on the daily board or Inventory:** run file **14** (`cart-laptop-brand.sql`), then edit each cart and set Dell or Chromebook. The UI cannot persist a brand until that column exists.

**If QR labels have no laptop codes:** run file **15**, then Admin → QR codes.

**If Inventory drag-and-drop order does not persist:** run file **16** (`cart-sort-order.sql`).

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

> **Symptom if wrong:** Google login from production opens  
> `http://localhost:3000/?code=…` → `ERR_CONNECTION_REFUSED`.  
> Cause: **Site URL** left as localhost, or production URLs missing from Redirect URLs  
> (Supabase then ignores `redirectTo` and falls back to Site URL).

Dashboard: Project → **Authentication** → **URL Configuration**

- **Site URL (production default):** `https://www.mycubicle.app`
- **Redirect URLs** (all needed — wildcards recommended):
  - `https://www.mycubicle.app/auth/callback`
  - `https://www.mycubicle.app/**`
  - `https://mycubicle.app/auth/callback`
  - `https://mycubicle.app/**`
  - `https://mycubicle.com/auth/callback`
  - `https://www.mycubicle.com/auth/callback`
  - `https://mycubicle.com/**`
  - `https://www.mycubicle.com/**`
  - `http://localhost:3000/auth/callback` (dev only)
  - `http://localhost:3000/**` (dev only)

### Supabase → Authentication → Providers → Google

- Enabled
- Client ID + Client Secret from Google Cloud
- Hosted domain hint: `rbe.sk.ca` (app still enforces domain + allowlist)

### Google Cloud OAuth (Web client)

- Authorized JavaScript origins:
  - `https://mycubicle.app`
  - `https://www.mycubicle.app`
  - `https://mycubicle.com`
  - `https://www.mycubicle.com`
  - `http://localhost:3000`
- Authorized redirect URIs (exact — **all** of these):
  - `https://www.mycubicle.app/__supabase/auth/v1/callback`
  - `https://mycubicle.app/__supabase/auth/v1/callback`
  - `https://www.mycubicle.com/__supabase/auth/v1/callback`
  - `https://mycubicle.com/__supabase/auth/v1/callback`
  - `http://localhost:3000/__supabase/auth/v1/callback` (dev only)
  - `https://<project-ref>.supabase.co/auth/v1/callback` (keep as fallback)
- The `mycubicle.app/__supabase/…` URIs are what hide
  `bpfwgfecydqxbkdhobqb.supabase.co` on Google’s “continue to …” screen.
  After adding them, staff see **mycubicle.app** instead.
- If app is **External + Testing**, add every staff Google account as Test users until published.

Bell times on the schedule board come from `lib/calendar/period-schedule.ts` (`America/Regina`). Cubicle does **not** currently push bookings into Google Calendar — no Calendar API or extra OAuth scope is required.

## DNS (registrar → Vercel)

### Live today: mycubicle.app

Attached on Vercel; apex redirects to `www` and serves the Next app.

### Attach mycubicle.com (currently a registrar lander, not the app)

1. **Vercel → Project → Settings → Domains** → add `mycubicle.com` and `www.mycubicle.com`.
2. At the registrar, set the DNS Vercel shows (typical):
   - Apex `A` record → Vercel IP
   - `www` `CNAME` → Vercel target
3. Wait for SSL + “Valid Configuration”.
4. Add the `.com` callback URLs in Supabase + Google origins (above).
5. Optional: set Vercel env `NEXT_PUBLIC_SITE_URL=https://mycubicle.com` and redeploy.

SSL is issued by Vercel (no separate registrar cert).

## Email notifications (production)

Staff email is **on in production** whenever the three Brevo vars above are set on **Vercel → Production**. Local `next dev` still does not send to school inboxes unless Settings → Email (local testing) is enabled.

| Event | Who is emailed | Toggle |
|-------|----------------|--------|
| Cart issue reported | Other admins | Settings → Issue email |
| Share invite | Invitee | Settings → Schedule email |
| Swap / handoff request or decision | Owner or requester | Settings → Schedule email |
| Booking moved or cancelled by admin | That teacher | Settings → Schedule email |

Sending is fire-and-forget (`after()` on `/api/notifications`). Booking and issue flows never wait on Brevo.

### Turn it on (if mail is still silent)

1. Vercel → Project → Settings → Environment Variables → **Production**:
   - `BREVO_API_KEY`
   - `BREVO_SENDER_EMAIL=noreply-mail@mycubicle.app`
   - `BREVO_SENDER_NAME=Cubicle`
2. Redeploy Production (env changes do not apply to an existing deployment).
3. In Supabase SQL Editor, run `supabase/notify-email.sql` if an older project is missing `notify_email` / `notify_issues`.
4. Settings → Email notifications should read **Live on this deployment**.
5. Report a test issue or send a share invite from a real staff account.

Without the API key, `/api/notifications` returns `{ skipped: true }` and no mail leaves the platform.

## BIMI (official logo next to Brevo emails)

BIMI is **DNS + a hosted logo + (for Gmail) a paid certificate**. It is not a Brevo app toggle. Sending stays `noreply-mail@mycubicle.app`.

The logo file is already in the repo:

- `https://www.mycubicle.app/.well-known/bimi/logo.svg`
- After you buy a mark certificate, drop the PEM next to it as `public/.well-known/bimi/certificate.pem`

### What is already true on mycubicle.app

| Record | Status |
|--------|--------|
| Brevo ownership TXT | Present |
| DKIM `brevo1._domainkey` / `brevo2._domainkey` | Present |
| DMARC | Present, but `p=none` — **blocks BIMI** |
| `default._bimi` | Missing — you add this after DMARC is enforced |

Staff inboxes are `@rbe.sk.ca` (Google Workspace). Gmail will **not** show the logo until you have a **CMC** or **VMC**. Yahoo can show a logo without a certificate. Outlook never shows BIMI.

### You do this at Name.com (DNS for mycubicle.app)

**1. Enforce DMARC** (edit the existing `_dmarc` TXT — do not add a second one):

```text
Host:  _dmarc
Type:  TXT
Value: v=DMARC1; p=quarantine; pct=100; rua=mailto:rua@dmarc.brevo.com
```

Only Cubicle/Brevo is sending on this domain today, so this is the usual next step. If anything else ever sends as `@mycubicle.app`, authenticate it first or mail will start landing in spam.

**2. After the logo is live on production**, add BIMI (no certificate yet — Yahoo only):

```text
Host:  default._bimi
Type:  TXT
Value: v=BIMI1; l=https://www.mycubicle.app/.well-known/bimi/logo.svg;
```

**3. For Gmail / school inboxes**, buy a certificate, host the PEM, then change the same TXT to:

```text
Host:  default._bimi
Type:  TXT
Value: v=BIMI1; l=https://www.mycubicle.app/.well-known/bimi/logo.svg; a=https://www.mycubicle.app/.well-known/bimi/certificate.pem;
```

Certificate options (you purchase these — not in Brevo):

| Certificate | Trademark? | Gmail logo | Gmail blue check | Apple Mail | Typical cost |
|-------------|------------|------------|------------------|------------|--------------|
| **CMC** | No | Yes | No | No | ~$400–750 / year |
| **VMC** | Yes, matching logo | Yes | Yes | Yes | ~$750–1,500 / year + trademark |

Issuers: [DigiCert](https://www.digicert.com/tls-ssl/compare-mark-certificates), [Sectigo](https://www.sectigo.com/ssl-certificates-tls/verified-mark-certificates), [Entrust](https://www.entrust.com/). Directory: [BIMI mark certificate issuers](https://bimigroup.org/vmc-issuers/).

Practical path for Cubicle: **CMC** (no trademark). Use **VMC** only if you register the cube mark and want the Gmail check.

### Check it

1. Open `https://www.mycubicle.app/.well-known/bimi/logo.svg` — black cube, no login wall.
2. [MXToolbox BIMI](https://mxtoolbox.com/bimi.aspx) → `mycubicle.app`
3. Send a real Brevo mail to a Gmail address. Logo can take up to 48 hours. Gmail still hides it without a CMC/VMC.

Brevo: one BIMI logo per account; keep the selector as `default`.

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
- [ ] Presence: signed-in staff show a green dot on avatars
- [ ] Share invite: invitee can accept / decline; board shows dual avatars
- [ ] Swap request: owner accept is a two-way exchange
- [ ] Admin → Inventory / QR codes / Reservations / Reports / Staff
- [ ] Inventory: set Dell or Chromebook; pause shows conflict dialog if booked
- [ ] QR codes: add a laptop code, print labels, scan on a phone
- [ ] Staff: add allowlist email; permanent shows blue tick
- [ ] Settings: profile photo/name save; booking policy (admin); teaching schedule (teacher)
- [ ] Settings → Email notifications shows **Live on this deployment**
- [ ] Share invite or issue report delivers mail from `noreply-mail@mycubicle.app`
- [ ] Phone (iOS / Android): Home / Scan / Profile shell; admins see Inventory tools
- [ ] Sign out works
- [ ] `/legal/*` pages load
- [ ] `/about` loads and is indexable
- [ ] `/signup` redirects to login

## Security checklist

- [ ] GitHub repo **private**
- [ ] `.env.local` never committed
- [ ] Service role key never public / never `NEXT_PUBLIC_`
- [ ] Rotate service role if it was ever leaked
- [ ] Vercel production env only (no demo login flag)
- [ ] Security headers enabled via `next.config.ts` (HSTS, frame deny, nosniff)
- [ ] Authenticated app routes stay `noindex`; `/login`, `/about`, `/legal` are indexable

## Post-deploy ops

1. Prefer **Admin → Staff** to manage allowlist (not only SQL).
2. Mark permanent vs substitute / temporary for blue-tick accuracy.
3. Set booking policy (advance window + max slots) in **Settings**.
4. Print cart / laptop labels from **Admin → QR codes** before asking staff to scan on phones.
5. Keep Google OAuth app verification status in mind for new test users.

## If something fails

| Symptom | Likely fix |
|---------|------------|
| “Google sign-in is not configured” | Missing `NEXT_PUBLIC_SUPABASE_*` on Vercel + redeploy |
| Everyone blocked | Empty allowlist or wrong domain constraint |
| Allowlist works but no blue tick | Run `employment-type.sql` |
| Board never updates live | Run `realtime.sql` + confirm Realtime enabled |
| Redirect loop / auth_failed | Redirect URL mismatch Google ↔ Supabase ↔ Site URL |
| Double booking still possible | Unique index on bookings must exist (`schema.sql`) |
| Phone never opens the camera | Grant camera permission; CSP / Permissions-Policy allow `camera=(self)` |
| QR scan does nothing | Confirm `cart-laptop-codes.sql` and that the printed payload is a Cubicle label |
