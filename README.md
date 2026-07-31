# Cubicle

**Authorized school staff platform for laptop-cart scheduling.**

Cubicle is an internal operations tool for teachers and IT. It provides period-based cart booking, a shared daily board, equipment issue reporting, and admin controls. Production access is limited to **allowlisted `@rbe.sk.ca` Google Workspace accounts** — not a public consumer product.

| | |
|---|---|
| **Production** | [https://mycubicle.app](https://mycubicle.app) |
| **School domain** | `@rbe.sk.ca` |
| **IT contact** | [it-support@rbe.sk.ca](mailto:it-support@rbe.sk.ca) |
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
| Admin maintenance of fleet, locks, and staff access | Sharing credentials or service-role secrets |
| Authorized `@rbe.sk.ca` staff on the IT allowlist | Commercial use unrelated to school operations |

Cubicle processes **staff operational data** (identity from Google Sign-In, bookings, issues, allowlist roles). Avoid entering sensitive student identifiers unless division procedure requires it. See in-app [Privacy Policy](https://mycubicle.app/legal/privacy).

---

## Capabilities

| Area | Description |
|------|-------------|
| **Schedule board** | Cart × period grid: open, yours, booked, restricted, maintenance |
| **Bookings** | Reserve by date and period; manage or cancel your own slots |
| **Stats** | Day-level booked, utilization, yours, free capacity, open issues |
| **Swaps** | Request a swap on another teacher’s booking; owner accepts or declines |
| **Issues** | Severity-tagged equipment reports from any cart |
| **Settings** | Profile, photo, notification preferences |
| **Admin** | Cart status, slot restrictions, booking window, staff allowlist |
| **Verified staff** | Permanent employment type may show a verification mark on the board |
| **Auth** | Google OAuth · school domain · IT allowlist · teacher / admin roles |
| **Realtime** | Multi-user board updates via Supabase Realtime |
| **Durability** | Authoritative data in Supabase Postgres — app deploys do not wipe school data |

---

## Access control & security

Cubicle is **not** open registration SaaS. Production enforces layered access:

| Control | Implementation |
|---------|----------------|
| School Google only | Email domain must be `@rbe.sk.ca` |
| IT allowlist | Exact email in Supabase `allowed_emails` |
| Role assignment | `teacher` or `admin` from allowlist / profile |
| Domain guard in DB | `restrict-domain.sql` rejects non-school allowlist rows |
| Row Level Security | Postgres RLS on platform tables; browser uses anon key only |
| Service role | `SUPABASE_SERVICE_ROLE_KEY` server-only — never `NEXT_PUBLIC_` |
| Demo login | Disabled unless `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` (**never** on Vercel production) |
| Repository | Private GitHub project |

Operator policy: [`SECURITY.md`](./SECURITY.md)  
In-product narrative: [https://mycubicle.app/legal/security](https://mycubicle.app/legal/security)

### Production environment variables

**Required (Vercel + local production-like runs):**

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

**Recommended on production:**

```text
NEXT_PUBLIC_CUBICLE_REQUIRE_REMOTE=true
NEXT_PUBLIC_SITE_URL=https://mycubicle.app
```

Spell **SUPABASE** correctly. Redeploy after any `NEXT_PUBLIC_*` change. Never commit `.env.local` or service-role keys.

---

## Data safety & durability

| Layer | Holds | On `git push` / Vercel redeploy |
|-------|--------|----------------------------------|
| **Supabase Postgres** | Bookings, carts, issues, staff, restrictions, profiles | **Unchanged** |
| **Vercel** | Application code only | Replaced with new build |
| **Browser** | Session + temporary cache | Not source of truth |

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
| Terms of Service | `/legal/terms` |
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
| Application | Next.js (App Router), React, TypeScript |
| UI | Tailwind CSS, accessible component primitives |
| Auth | Supabase Auth · Google OAuth (Workspace) |
| Data | Supabase Postgres · RLS · Realtime |
| Hosting | Vercel · `mycubicle.app` (optional `mycubicle.com`) |
| Timezone (bell / calendar helpers) | America/Regina |

---

## Local development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm
- Supabase project with schema applied and Google provider configured

### Setup

```bash
git clone https://github.com/neilrxthod/cubicle.git
cd cubicle
npm install
```

Create `.env.local` (never commit secrets):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
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
| 8 | `supabase/booking-last-editor.sql` | Optional last-editor metadata on bookings |

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

**Local-only** demo picker (never enable on Vercel production):

```env
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
```

Without Supabase env vars, localhost may use browser-local demo storage. Production hosts hard-stop if the database is not connected.

---

## Project structure

```text
cubicle/
├── app/                 # Routes: board, admin, auth, legal, settings
├── components/
│   ├── app/             # Dashboard frame, auth gate, bootstrap
│   ├── auth/            # Login, wordmark, legal consent
│   ├── legal/           # Legal shell + navigation
│   ├── tool-ui/         # Schedule stats display
│   └── ui/              # Shared UI primitives
├── lib/
│   ├── auth/            # Session, allowlist, school domain, OAuth
│   ├── calendar/        # Period / bell helpers (America/Regina)
│   ├── data/            # Platform store + durability guards
│   ├── legal/           # Legal constants and link map
│   ├── staff/           # Employment / verified badge rules
│   └── supabase/        # Clients, mappers, platform API, realtime
├── supabase/            # SQL schema, seeds, operator docs
├── PRODUCTION.md        # Ship checklist
├── SECURITY.md          # Vulnerability reporting + access model
└── public/              # Static assets
```

---

## Roles

| Role | Access |
|------|--------|
| **Teacher** | Schedule board, book / cancel own slots, swaps, issues, settings |
| **Admin / IT** | Teacher access + cart status, restrictions, booking policy, staff allowlist |

Permanent staff may show a **verified** indicator; substitute / temporary staff typically do not.

---

## Operator responsibilities

1. Keep the GitHub repository **private**.
2. Never commit environment files or service-role keys.
3. Treat the browser anon key as public; rely on **RLS + domain + allowlist**.
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

---

## License

Private project — all rights reserved. Unauthorized redistribution of source code or credentials is prohibited. Use is limited to authorized school staff under the Terms of Service and school division policy.

---

<p align="center">
  <strong>Cubicle</strong> · Book the cart. Teach the class.<br/>
  <sub>Authorized @rbe.sk.ca staff only · Operational data protected in Supabase Postgres</sub>
</p>
