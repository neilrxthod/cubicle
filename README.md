# Cubicle

**School laptop cart scheduling for teachers and IT.**

Book carts by period, track availability on a daily board, report issues, and manage swaps — built for the school day, not generic calendar software.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

## Features

| Area | What you get |
|------|----------------|
| **Daily board** | Period-by-period view of cart bookings for any day |
| **Bookings** | Teachers reserve carts by period, room, and class |
| **Swap requests** | Request and resolve schedule swaps when plans change |
| **Issues** | Report cart problems with severity and status tracking |
| **Admin console** | Manage carts, bookings, issues, and day-to-day ops |
| **Auth** | Sign in, sign up, email verification, password reset |
| **Roles** | Teacher and admin experiences with role-aware access |

Seed data includes sample carts (Library, Science wing, Media center, and more) and period blocks (Period 1–8) so you can explore the app immediately.

---

## Tech stack

- **Framework** — [Next.js](https://nextjs.org/) 16 (App Router)
- **UI** — React 19, [Tailwind CSS](https://tailwindcss.com/) 4, [shadcn/ui](https://ui.shadcn.com/)
- **Language** — TypeScript
- **Motion** — [Motion](https://motion.dev/)
- **Dates** — [date-fns](https://date-fns.org/)

---

## Getting started

### Prerequisites

- **Node.js** 18+ (recommended: current LTS)
- **npm** (comes with Node)

### Install & run

```bash
# Clone
git clone https://github.com/neilrxthod/cubicle.git
cd cubicle

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Supabase (backend)

Cubicle uses [Supabase](https://supabase.com/) for **Google auth (allowlist)**, **Postgres data**, and **RLS**.

1. Fill `.env.local` from `.env.local.example` (Project URL + anon + service_role)
2. Run SQL in order: `schema.sql` → `allowed-emails.sql` → `seed-carts.sql`
3. Add staff emails to `allowed_emails`
4. Enable Google provider (see checklist)
5. Restart `npm run dev`

**Full checklist:** [`supabase/SETUP.md`](./supabase/SETUP.md)

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## Demo accounts

Use these credentials on the login page to try teacher and admin flows:

| Role | Email | Password |
|------|--------|----------|
| **Teacher** | `teacher@cubicle.edu` | `teacher123` |
| **Admin** | `admin@cubicle.edu` | `admin123` |

> Demo auth is local for product exploration. Do not use these credentials in production.

---

## Project structure

```text
cubicle/
├── app/                  # Routes (login, board, bookings, admin, settings, …)
├── components/           # UI: auth, board, dialogs, admin, shared primitives
├── lib/
│   ├── auth/             # Session, demo accounts, validation
│   ├── cubicle/          # Carts, bookings, issues, periods, seed data
│   └── data/             # Client platform store
├── hooks/                # Shared React hooks
└── public/               # Static assets
```

---

## Roles at a glance

**Teachers**

- View the daily availability board  
- Book carts for class periods  
- Manage their bookings and report issues  
- Request swaps when schedules conflict  

**Admins / IT**

- Oversee carts, bookings, and open issues  
- Update cart status (ready, maintenance, offline)  
- Keep the board accurate for the whole school  

---

## Roadmap notes

Cubicle is under active development. Near-term product direction includes richer persistence, stronger multi-user auth, and tighter IT workflows around cart health and reporting.

---

## License

Private project — all rights reserved unless otherwise stated.

---

<p align="center">
  <strong>Cubicle</strong> · Book the cart. Teach the class.
</p>
