# Cubicle

**School laptop-cart scheduling for teachers and IT.**

Cubicle helps schools book laptop carts by period, see who has what on a daily board, report equipment issues, and coordinate swaps — with **Google sign-in limited to allowlisted `@rbe.sk.ca` staff**.

**Live:** [https://mycubicle.app](https://mycubicle.app)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)

---

## Product overview

| Area | Capability |
|------|------------|
| **Schedule / daily board** | Cart × period grid — open, yours, booked, restricted, maintenance |
| **Bookings** | Reserve by date, period, class, subject, notes; manage / cancel own slots |
| **Stats** | Day-level booked, utilization, yours, free slots, open issues (+ sparklines) |
| **Swaps** | Request a swap on someone else’s booking; owner accepts or declines |
| **Issues** | Report severity-tagged equipment problems from any cart |
| **Settings** | Profile, photo, notification prefs, role-aware shortcuts |
| **Google Calendar** | Optional connect · auto-sync book/cancel · Add to Calendar deep links |
| **Admin** | Cart maintenance, slot restrictions, booking window, staff allowlist |
| **Verified staff** | Permanent employment type → blue verification tick on the board |
| **Auth** | Google OAuth · `@rbe.sk.ca` only · IT allowlist · teacher / admin roles |
| **Realtime** | Multi-user board updates via Supabase Realtime |
| **Data durability** | Supabase Postgres — code deploys never wipe school data |
| **Compliance** | Terms, Privacy, Security, Acceptable Use in-app |

---

## Access & security (production)

Cubicle is **not** a public consumer app.

| Rule | Enforcement |
|------|-------------|
| School Google only | `@rbe.sk.ca` required |
| Allowlist | Exact email must be approved by IT (`allowed_emails`) |
| Other domains | Blocked (Gmail, Yahoo, personal accounts, etc.) |
| Roles | `teacher` or `admin` from allowlist / profile |
| Secrets | Service role key server-only; never `NEXT_PUBLIC_` |
| Repository | **Private** GitHub project |

In-product security narrative: [https://mycubicle.app/legal/security](https://mycubicle.app/legal/security)  
Operator policy: [`SECURITY.md`](./SECURITY.md)

### Required Vercel environment variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Optional (recommended on production):

```text
NEXT_PUBLIC_CUBICLE_REQUIRE_REMOTE=true
NEXT_PUBLIC_SITE_URL=https://mycubicle.app
```

Spell **SUPABASE** correctly (not `SUBASE`). Redeploy after any `NEXT_PUBLIC_*` change.

---

## Legal & compliance (in product)

| Document | Path |
|----------|------|
| Terms of Service | `/legal/terms` |
| Privacy Policy | `/legal/privacy` |
| Security & Data Safety | `/legal/security` |
| Acceptable Use | `/legal/acceptable-use` |
| Index | `/legal` |

Linked from the **login screen**, **auth footer**, and **in-app footer**.  
Have school division IT / privacy / legal review them before formal board adoption.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Radix), Motion, Lucide |
| Auth | Supabase Auth · Google OAuth |
| Data | Supabase Postgres · Row Level Security · Realtime |
| Hosting | Vercel · `mycubicle.app` (optional `mycubicle.com`) |

---

## Local development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm
- A Supabase project with schema + Google provider configured

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

Run SQL in the Supabase SQL Editor, **in order**:

| # | File | Purpose |
|---|------|---------|
| 1 | `supabase/schema.sql` | Tables, RLS, profile trigger |
| 2 | `supabase/allowed-emails.sql` | Staff allowlist + admin policies |
| 3 | `supabase/seed-carts.sql` | Laptop carts (safe re-run) |
| 4 | `supabase/restrict-domain.sql` | DB enforces `@rbe.sk.ca` on allowlist |
| 5 | `supabase/realtime.sql` | Live multi-user board |
| 6 | `supabase/employment-type.sql` | Permanent / sub / temp + blue tick |
| 7 | `supabase/profile-name-sync.sql` | Fan-out display name to bookings / issues / swaps |

Then:

- Production checklist → [`PRODUCTION.md`](./PRODUCTION.md)
- Data safety (survives every push) → [`supabase/DATA_DURABILITY.md`](./supabase/DATA_DURABILITY.md)
- Backend detail → [`supabase/SETUP.md`](./supabase/SETUP.md)
- Supabase file index → [`supabase/README.md`](./supabase/README.md)

Add staff in **Table Editor → `allowed_emails`** (or Admin → Staff after first admin login):

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

Optional local demo picker (**off by default; never enable on Vercel production**):

```env
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
```

Without Supabase env vars, localhost can run a browser-local demo seed. Production hosts hard-stop if the database is not connected.

---

## Project structure

```text
cubicle/
├── app/                    # App Router routes (board, admin, auth, legal, settings, …)
├── components/
│   ├── app/                # Dashboard frame, auth gate, bootstrap
│   ├── auth/               # Login / signup / wordmark
│   ├── legal/              # Legal shell + nav
│   ├── tool-ui/            # Stats display + sparklines
│   └── ui/                 # shadcn primitives
├── lib/
│   ├── auth/               # Session, allowlist, school domain, OAuth helpers
│   ├── calendar/           # Bell schedule (America/Regina) for calendar events
│   ├── data/               # Platform store + durability guards
│   ├── legal/              # Legal link constants
│   ├── staff/              # Employment / verified badge rules
│   └── supabase/           # Clients, mappers, platform API, realtime
├── supabase/               # SQL schema, seeds, setup docs
├── PRODUCTION.md           # Ship checklist
├── SECURITY.md             # Vulnerability reporting + access model
└── public/                 # Static assets
```

---

## Roles

| Role | Access |
|------|--------|
| **Teacher** | Schedule board, book / cancel own slots, swaps, issues, settings |
| **Admin / IT** | Everything teachers can + cart status, restrictions, booking policy, staff allowlist |

Permanent staff can show a **verified** badge; substitutes / temporary staff do not.

---

## Credential & data safety (operators)

1. Keep the GitHub repo **private**.
2. Never commit `.env.local` or service-role keys.
3. Anon key may ship to the browser; rely on **RLS + domain + allowlist**.
4. Rotate `SUPABASE_SERVICE_ROLE_KEY` if it was ever exposed.
5. Offboard staff by removing them from `allowed_emails`.
6. Prefer least privilege on Google Cloud OAuth clients.
7. Code deploys never wipe Postgres — see [`supabase/DATA_DURABILITY.md`](./supabase/DATA_DURABILITY.md).

---

## Deployment

1. Connect the private GitHub repo to Vercel.
2. Set the required environment variables (and optional remote lock).
3. Attach `mycubicle.app` (and `www` / `mycubicle.com` if used) in Vercel → Domains.
4. Update Supabase Auth URL config + Google OAuth origins for production.
5. Confirm legal pages load at `https://mycubicle.app/legal`.
6. Walk through [`PRODUCTION.md`](./PRODUCTION.md).

---

## License

Private project — all rights reserved. Unauthorized redistribution of source or credentials is prohibited.

---

<p align="center">
  <strong>Cubicle</strong> · Book the cart. Teach the class.<br/>
  <sub>Authorized @rbe.sk.ca staff only</sub>
</p>
