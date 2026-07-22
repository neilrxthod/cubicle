# Cubicle

**Professional school laptop-cart scheduling for teachers and IT.**

Cubicle helps schools book laptop carts by period, track availability on a daily board, report equipment issues, and coordinate swaps — with **Google sign-in limited to allowlisted `@rbe.sk.ca` staff**.

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
| **Daily board** | Period-by-period cart availability |
| **Bookings** | Reserve carts by date, period, class, and room |
| **Settings** | Profile, Google Calendar connect, email prefs, role-aware shortcuts |
| **Google Calendar** | Connect · auto-sync book/cancel · one-click Add to Calendar |
| **Swaps** | Request and resolve booking swaps |
| **Issues** | Report severity-tagged equipment problems |
| **Admin** | Cart status, restrictions, staff allowlist + verified badges |
| **Auth** | Google OAuth · school domain only · IT allowlist |
| **Data durability** | Supabase Postgres — deploys never wipe bookings/staff/carts |
| **Compliance** | Terms, Privacy, Security, Acceptable Use on-site |

---

## Access & security (production)

Cubicle is **not** a public consumer app.

| Rule | Enforcement |
|------|-------------|
| School Google only | `@rbe.sk.ca` required |
| Allowlist | Exact email must be approved by IT |
| Other domains | Blocked (Gmail, Yahoo, etc.) |
| Roles | `teacher` or `admin` from allowlist / profile |
| Secrets | Service role key server-only; never `NEXT_PUBLIC_` |
| Repository | **Private** GitHub project |

Full security narrative: [`/legal/security`](https://mycubicle.app/legal/security) (after deploy).

### Required Vercel environment variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
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

These pages are linked from the **login screen**, **auth footer**, and **in-app footer**.  
Have school division IT / privacy / legal review them before formal board adoption.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, Motion |
| Auth | Supabase Auth · Google OAuth |
| Data | Supabase Postgres · Row Level Security |
| Hosting | Vercel · custom domain `mycubicle.app` |

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

Create `.env.local` (see names above; never commit secrets):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Run SQL (Supabase SQL Editor), in order:

1. `supabase/schema.sql`
2. `supabase/allowed-emails.sql`
3. `supabase/seed-carts.sql`
4. `supabase/restrict-domain.sql` (enforces `@rbe.sk.ca` on allowlist)
5. `supabase/realtime.sql` (live multi-user board)
6. `supabase/employment-type.sql` (permanent / sub / temp + blue tick)

Production checklist: [`PRODUCTION.md`](./PRODUCTION.md)  
Data safety (survives every push): [`supabase/DATA_DURABILITY.md`](./supabase/DATA_DURABILITY.md)

Add staff in **Table Editor → `allowed_emails`** (or Admin → Staff after first admin login), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Detailed backend checklist:** [`supabase/SETUP.md`](./supabase/SETUP.md)

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

Optional local demo picker (off by default; **do not enable on Vercel**):

```env
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
```

---

## Project structure

```text
cubicle/
├── app/                 # Routes (board, admin, auth callback, legal, …)
├── components/          # UI, auth, admin, legal shell
├── lib/
│   ├── auth/            # Session, allowlist, school domain gate
│   ├── legal/           # Legal constants
│   ├── supabase/        # Clients + platform API
│   └── data/            # Client store + hydrate
├── supabase/            # SQL schema, allowlist, seeds, setup docs
└── public/              # Static assets
```

---

## Roles

**Teachers** — board, bookings, issues, swaps, profile settings  

**Admins / IT** — maintenance console, cart status, restrictions, allowlist staff  

---

## Credential & data safety (operators)

1. Keep the GitHub repo **private**.  
2. Never commit `.env.local` or service-role keys.  
3. Anon key may be public in the browser; rely on **RLS + domain + allowlist**.  
4. Rotate `SUPABASE_SERVICE_ROLE_KEY` if it was ever exposed.  
5. Offboard staff by removing them from `allowed_emails`.  
6. Prefer least privilege on Google Cloud OAuth clients.  

---

## Deployment

1. Connect the private GitHub repo to Vercel.  
2. Set the three environment variables.  
3. Attach `mycubicle.app` (and `www`) DNS as Vercel instructs.  
4. Update Supabase Auth URL config + Google OAuth origins for production.  
5. Confirm legal pages load at `https://mycubicle.app/legal`.  

---

## License

Private project — all rights reserved. Unauthorized redistribution of source or credentials is prohibited.

---

<p align="center">
  <strong>Cubicle</strong> · Book the cart. Teach the class.<br/>
  <sub>Authorized @rbe.sk.ca staff only</sub>
</p>
