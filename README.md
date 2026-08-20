# Cubicle

**Authorized school staff platform for laptop-cart scheduling.**

Cubicle is an internal operations tool for teachers and IT. It provides period-based cart booking, a shared daily board, equipment issue reporting, QR labels, and admin fleet controls. Production access is limited to **allowlisted `@rbe.sk.ca` Google Workspace accounts** — not a public consumer product.

| | |
|---|---|
| **Production** | [https://mycubicle.app](https://mycubicle.app) |
| **School domain** | `@rbe.sk.ca` |
| **IT contact** | [it-support@rbe.sk.ca](mailto:it-support@rbe.sk.ca) |
| **Platform version** | Shown in the product header (auto-bumped on each git commit) |
| **Repository** | Private — all rights reserved |

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)

---

## Intended use

| Allowed | Not allowed |
|---------|-------------|
| Booking and managing school laptop carts by period | Public sign-up or personal Gmail / non-school accounts |
| Reporting equipment issues for IT follow-up | Storing student PERs as a primary purpose |
| Admin maintenance of fleet, locks, reservations, and staff access | Sharing credentials or service-role secrets |
| Authorized `@rbe.sk.ca` staff on the IT allowlist | Commercial use unrelated to school operations |

Cubicle processes **staff operational data** (identity from Google Sign-In, bookings, issues, allowlist roles). Avoid entering sensitive student identifiers unless division procedure requires it. See in-app [Privacy Policy](https://mycubicle.app/legal/privacy).

---

## Capabilities

### Schedule (home)

| Feature | Description |
|---------|-------------|
| **Daily board** | Cart × period grid: free, yours, booked, shared, restricted, paused |
| **Stats strip** | Brand mesh metrics — booked, utilization, yours, issues, free |
| **Book / cancel** | Reserve by date and period; cancel own bookings |
| **Shares** | Invite a colleague onto a slot (dual avatars); invitee accepts or declines |
| **Swaps** | Request another teacher’s slot; owner accepts or declines a two-way exchange |
| **Presence** | Green dot on avatars when that staff member is signed in |
| **Fleet marks** | Dell / Chromebook logos on carts; admin drag-and-drop row order |
| **Verified staff** | Permanent employment may show a verification mark |
| **Booking limits** | Admin-set max slots per teacher per day and how far ahead teachers may book |

### Teacher tools

| Feature | Description |
|---------|-------------|
| **My bookings** | Upcoming and past reservations; cancel upcoming |
| **Issues** | Severity-tagged equipment reports; open / resolved filters; optional delete |
| **Settings** | Profile, photo, email notifications, account deletion; **teaching schedule** (subjects, grades, periods) |
| **Onboarding** | First-run photo + teaching load (or booking window for admins) |

### Phone (iOS / Android)

On iPhone, iPad, and Android the app opens a phone shell instead of the desktop board. Add to Home Screen for standalone PWA chrome (`manifest` + `public/sw.js`).

| Surface | Description |
|---------|-------------|
| **Home** | Scan button plus bookings, schedule, issues, shares, swaps |
| **Scan** | Camera reads cart and laptop QR labels printed from Admin → QR codes |
| **Profile** | Settings and two-step sign-out |
| **Admin (phone)** | Inventory, QR codes, reservations, reports, staff |

Desktop browsers keep the full schedule board and header nav (Schedule, Bookings, Issues, Admin).

### Admin console

| Tab | Description |
|-----|-------------|
| **Inventory** | Add / edit / delete carts (name, location, Dell or Chromebook); **Pause** / **Resume**; conflict dialog before pause; drag-and-drop order; optional operational reset |
| **QR codes** | Per-cart and per-laptop case codes; preview and print label PDFs |
| **Reservations** | Filterable table; reassign / delete; LiquidMetal CSV/PDF export |
| **Reports** | KPI strip, usage charts, issue mix; LiquidMetal export |
| **Staff** | Allowlist invite / restore / remove; verified badge |

Booking policy (advance window + max slots per teacher per day) lives in **Settings**, not a separate admin tab.

### Auth & setup

| Feature | Description |
|---------|-------------|
| **Google OAuth** | School Workspace only (`@rbe.sk.ca`) |
| **Allowlist** | Exact email in Supabase `allowed_emails` |
| **Roles** | `teacher` or `admin` from allowlist / profile |
| **Onboarding (production)** | **Once** after first successful auth |
| **Onboarding (local `next dev`)** | Re-prompted after every sign-in for testing |
| **Later edits** | Teaching schedule and booking policy in **Settings** (no wizard re-run) |
| **Account deletion** | Staff can delete their own account from Settings |

### Platform

| Feature | Description |
|---------|-------------|
| **Realtime** | Multi-user board and presence updates via Supabase Realtime |
| **Durability** | Authoritative data in Supabase Postgres — deploys do not wipe school data |
| **Copy** | Direct, low-ambiguity product labels (actions name the object and outcome) |
| **Email** | Production Brevo notifications for shares, swaps, booking changes, and admin issue alerts |
| **SEO** | Public `/login`, `/about`, `/legal/*`; authenticated app routes stay `noindex` |

---

## Access control & security

Cubicle is **not** open registration SaaS. Production enforces layered access:

| Control | Implementation |
|---------|----------------|
| School Google only | Email domain must be `@rbe.sk.ca` |
| IT allowlist | Exact email in Supabase `allowed_emails` |
| Role assignment | `teacher` or `admin` from allowlist / profile |
| Domain guard in DB | `restrict-domain.sql` rejects non-school allowlist rows |
| Row Level Security | Postgres RLS on platform tables; browser uses the publishable / anon key only |
| Service role | `SUPABASE_SERVICE_ROLE_KEY` server-only — never `NEXT_PUBLIC_` |
| Demo login | Disabled unless `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` (**never** on Vercel production) |
| Camera | Phone scan uses the device camera; `Permissions-Policy` allows `camera=(self)` only |
| Repository | Private GitHub project |

Operator policy: [`SECURITY.md`](./SECURITY.md)
In-product narrative: [https://mycubicle.app/legal/security](https://mycubicle.app/legal/security)

### Production environment variables

**Required (Vercel + local production-like runs):**

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   # preferred (sb_publishable_…)
# NEXT_PUBLIC_SUPABASE_ANON_KEY        # legacy JWT — still accepted if publishable is unset
SUPABASE_SERVICE_ROLE_KEY
BREVO_API_KEY
BREVO_SENDER_EMAIL
```

**Recommended on production:**

```text
NEXT_PUBLIC_CUBICLE_REQUIRE_REMOTE=true
NEXT_PUBLIC_SITE_URL=https://mycubicle.app
BREVO_SENDER_NAME=Cubicle
```

Copy the full template from [`.env.local.example`](./.env.local.example). Spell **SUPABASE** correctly. Redeploy after any `NEXT_PUBLIC_*` change. Never commit `.env.local` or service-role keys.

---

## Data safety & durability

| Layer | Holds | On `git push` / Vercel redeploy |
|-------|--------|----------------------------------|
| **Supabase Postgres** | Bookings, carts, issues, staff, restrictions, shares, laptop codes, profiles | **Unchanged** |
| **Vercel** | Application code only | Replaced with new build |
| **Browser** | Session + onboarding prefs cache | Not source of truth for bookings |

- Code deploys **never** wipe school operational data.
- Do **not** point production at a new empty Supabase project (appears as total data loss).
- Do **not** `drop` / `truncate` live tables without an approved backup and change window.
- Offboard staff by removing them from `allowed_emails`.
- Rotate secrets immediately if exposure is suspected.

Full detail: [`supabase/DATA_DURABILITY.md`](./supabase/DATA_DURABILITY.md)

---

## Legal & compliance

In-app documents for authorized school use (Saskatchewan, Canada; school division policies; applicable privacy law including FOIP for public bodies where applicable):

| Document | Path |
|----------|------|
| Terms & Conditions | `/legal/terms` |
| Privacy Policy | `/legal/privacy` |
| Security & Data Safety | `/legal/security` |
| Acceptable Use | `/legal/acceptable-use` |
| Index | `/legal` |

Linked from login, auth footer, and product footer. **Division IT, privacy, and legal contacts should review these before formal board or division-wide adoption.** Effective date and contact constants live in `lib/legal/constants.ts` (`it-support@rbe.sk.ca`).

Cubicle is designed as an **internal staff tool**, not a student-facing learning platform and not a system of record for student cumulative files.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Application | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn (Base UI + remaining Radix), Motion |
| Auth | Supabase Auth · Google OAuth (Workspace) |
| Data | Supabase Postgres · RLS · Realtime |
| Email | Brevo transactional API |
| Hosting | Vercel · `mycubicle.app` |
| Phone | Web app manifest + service worker (standalone PWA) |
| Timezone | America/Regina (bell schedule helpers) |

---

## Local development

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm
- Supabase project with schema applied and Google provider configured (for production-like auth)

### Setup

```bash
git clone https://github.com/neilrxthod/cubicle.git
cd cubicle
npm install
```

Create `.env.local` from [`.env.local.example`](./.env.local.example) (never commit secrets):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...
```

Run SQL in the Supabase SQL Editor **in order** (see [`supabase/README.md`](./supabase/README.md)):

| # | File | Purpose |
|---|------|---------|
| 1 | `supabase/schema.sql` | Tables, RLS, profile trigger |
| 2 | `supabase/allowed-emails.sql` | Staff allowlist + admin policies |
| 3 | `supabase/seed-carts.sql` | Laptop carts (safe re-run) |
| 4 | `supabase/restrict-domain.sql` | DB enforces `@rbe.sk.ca` on allowlist |
| 5 | `supabase/realtime.sql` | Live multi-user board |
| 6 | `supabase/employment-type.sql` | Permanent / sub / temp + verified mark |
| 7 | `supabase/profile-name-sync.sql` | Display-name fan-out to operational rows |
| 8 | `supabase/booking-last-editor.sql` | Last-editor metadata on bookings |
| 9 | `supabase/swap-accept.sql` | Atomic two-way cart swap |
| 10 | `supabase/booking-policy-max-slots.sql` | Max cart slots per teacher per day |
| 11 | `supabase/booking-share.sql` | Share / borrow co-teacher on a slot |
| 12 | `supabase/booking-share-resolve.sql` | Teachers can accept / decline a share invite |
| 13 | `supabase/booking-share-declined.sql` | Owner notice when an invitee declines |
| 14 | `supabase/cart-laptop-brand.sql` | Dell / Chromebook fleet on inventory carts |
| 15 | `supabase/cart-laptop-codes.sql` | Per-cart laptop case codes for QR labels |
| 16 | `supabase/cart-sort-order.sql` | Admin drag-and-drop cart order |
| 17 | `supabase/issues-delete.sql` | Reporter / admin issue delete |
| 18 | `supabase/notify-email.sql` | Profile email notification toggles |

If an existing project skipped later files, run **`supabase/repair-live.sql` once** instead of guessing. For an official empty go-live, see [`supabase/SETUP.md`](./supabase/SETUP.md).

Add real staff in **Table Editor → `allowed_emails`** (or Admin → Staff after first admin login). Use only `@rbe.sk.ca` addresses.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run version:bump` | Manual platform version bump (also runs on commit) |
| `node --env-file=.env.local scripts/diagnose-supabase.mjs` | Live schema / RPC health check (no secrets printed) |

**Local-only** demo picker (never enable on Vercel production):

```env
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
```

Localhost keeps platform data in a browser sandbox by default (even if production Supabase keys are in `.env.local`), so developer carts/bookings never hit the school database. Opt into remote only with `NEXT_PUBLIC_CUBICLE_USE_REMOTE_IN_DEV=true` and a staging project. Production hosts hard-stop if the database is not connected.

### Onboarding in local vs production

| Environment | Behavior |
|-------------|----------|
| **`next dev` (local)** | After sign-in, first-run setup is **reset and shown every time** so UI can be tested |
| **Production** | First-run wizard runs **once** per user; later changes go through **Settings** |

---

## Project structure

```text
cubicle/
├── app/                      # Routes: board, admin, auth, legal, settings, onboarding
├── components/
│   ├── admin/                # QR labels, laptop brands, reports charts
│   ├── app/                  # Dashboard frame, phone PWA shell, QR scanner
│   ├── auth/                 # Login, wordmark, legal consent
│   ├── legal/                # Legal shell + navigation
│   ├── onboarding/           # First-run wizard
│   ├── settings/             # Profile, email, booking policy / teaching load
│   ├── tool-ui/              # Schedule stats display (brand mesh)
│   ├── admin-console.tsx     # Inventory, QR codes, reservations, reports, staff
│   └── ui/                   # Shared UI primitives
├── lib/
│   ├── auth/                 # Session, allowlist, school domain, OAuth
│   ├── booking/              # Slot and swap rules
│   ├── calendar/             # Period schedule helpers (America/Regina)
│   ├── data/                 # Platform store + durability guards
│   ├── email/                # Brevo templates and dispatch
│   ├── export/               # Corporate PDF + QR label PDF
│   ├── labels/               # Cart / laptop QR payloads
│   ├── legal/                # Legal constants and link map
│   ├── onboarding/           # First-run prefs (localStorage); production one-time
│   ├── staff/                # Employment / verified badge + live presence
│   └── supabase/             # Clients, mappers, platform API, realtime
├── supabase/                 # SQL schema, seeds, operator docs
├── scripts/                  # Version bump + Supabase diagnose
├── PRODUCTION.md             # Ship checklist
├── SECURITY.md               # Vulnerability reporting + access model
└── public/                   # Icons, service worker, BIMI, llms.txt
```

---

## Roles

| Role | Access |
|------|--------|
| **Teacher** | Schedule board, book / cancel own slots, shares, swaps, issues, my bookings, settings (including teaching schedule), phone Scan |
| **Admin / IT** | Teacher access + inventory pause/resume, QR labels, reservations ops, reports, staff allowlist, booking policy |

Permanent staff may show a **verified** indicator; substitute / temporary staff typically do not.

---

## Operator responsibilities

1. Keep the GitHub repository **private**.
2. Never commit environment files or service-role keys.
3. Treat the browser publishable / anon key as public; rely on **RLS + domain + allowlist**.
4. Rotate `SUPABASE_SERVICE_ROLE_KEY` if it may have been exposed.
5. Remove offboarded staff from `allowed_emails` promptly.
6. Prefer least privilege on Google Cloud OAuth clients (Internal / Workspace where possible).
7. Review Auth logs after incidents; coordinate with division IT.

---

## Deployment

1. Connect the private GitHub repo to Vercel.
2. Set required environment variables (and remote lock).
3. Attach `mycubicle.app` (and optional aliases) in Vercel → Domains.
4. Align Supabase Auth redirect URLs and Google OAuth origins with production.
5. Confirm legal pages at `https://mycubicle.app/legal`.
6. Complete [`PRODUCTION.md`](./PRODUCTION.md).

---

## Related documentation

| Document | Purpose |
|----------|---------|
| [`PRODUCTION.md`](./PRODUCTION.md) | Production readiness checklist |
| [`SECURITY.md`](./SECURITY.md) | Security policy and vulnerability reporting |
| [`supabase/README.md`](./supabase/README.md) | SQL file index |
| [`supabase/SETUP.md`](./supabase/SETUP.md) | Supabase + Google OAuth setup |
| [`supabase/DATA_DURABILITY.md`](./supabase/DATA_DURABILITY.md) | Why deploys never erase school data |
| [`components/tool-ui/stats-display/README.md`](./components/tool-ui/stats-display/README.md) | Schedule stats component |
| [`AGENTS.md`](./AGENTS.md) | Agent notes for this Next.js version |

---

## License

Private project — all rights reserved. Unauthorized redistribution of source code or credentials is prohibited. Use is limited to authorized school staff under the Terms & Conditions and school division policy.

---

<p align="center">
  <strong>Cubicle</strong> · Book the cart. Teach the class.<br/>
  <sub>Authorized @rbe.sk.ca staff only · Operational data protected in Supabase Postgres</sub>
</p>
