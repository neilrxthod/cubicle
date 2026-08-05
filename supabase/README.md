# Supabase — Cubicle data platform

Cubicle’s **system of record** for school operational data is **Supabase Postgres**, not the Next.js deploy, not browser localStorage, and not GitHub.

This folder contains SQL migrations, seeds, and operator docs for a production-safe school deployment.

| | |
|---|---|
| **Full setup** | [SETUP.md](./SETUP.md) |
| **Data durability** | [DATA_DURABILITY.md](./DATA_DURABILITY.md) |
| **School domain** | `@rbe.sk.ca` only on allowlist |
| **IT contact** | [it-support@rbe.sk.ca](mailto:it-support@rbe.sk.ca) |

---

## Compliance & safety principles

| Principle | Practice |
|-----------|----------|
| **Least privilege** | Browser uses the anon key under **Row Level Security**. Service role stays server-only. |
| **School identity** | Google OAuth restricted to `@rbe.sk.ca` plus exact-email allowlist. |
| **No public signup** | Unauthorized users are rejected in the auth callback and cannot obtain a usable profile. |
| **Deploy isolation** | `git push` / Vercel rebuild **never** truncates or drops production tables. |
| **Staff operational data** | Bookings, issues, and allowlist entries are school records — treat as confidential. |
| **Student data** | Not a primary student information system. Avoid storing student PERs or sensitive identifiers unless required by division procedure. |
| **Change control** | Run SQL in order on a known project; take a backup before destructive experiments (never on live without approval). |

---

## SQL files (run in order)

Run each file fully in the Supabase **SQL Editor** and wait for **Success** before the next.

| Order | File | Purpose |
|------:|------|---------|
| 1 | `schema.sql` | Core tables, RLS policies, profile trigger |
| 2 | `allowed-emails.sql` | Staff allowlist + admin policies |
| 3 | `seed-carts.sql` | Laptop cart inventory (**safe re-run**; does not overwrite cart status) |
| 4 | `restrict-domain.sql` | Database enforces `@rbe.sk.ca` on allowlist inserts/updates |
| 5 | `realtime.sql` | Realtime publication for multi-user board sync |
| 6 | `employment-type.sql` | Permanent / substitute / temporary + verified staff indicator |
| 7 | `profile-name-sync.sql` | Fan-out of display name to bookings, issues, swaps |
| 8 | `booking-last-editor.sql` | Optional last-editor columns on bookings (audit-friendly) |
| 9 | `swap-accept.sql` | Atomic two-way cart swap accept, offered cart column, owner RLS |
| 10 | `booking-policy-max-slots.sql` | Admin max cart slots per teacher per day (`max_slots_per_teacher_per_day`) |

**Never** run ad-hoc `drop table` / `truncate` against a live school project without an approved backup and change window.

---

## Operator documentation

| File | Role |
|------|------|
| [SETUP.md](./SETUP.md) | End-to-end Supabase, Google OAuth, env keys, allowlist |
| [DATA_DURABILITY.md](./DATA_DURABILITY.md) | Why application deploys never wipe school data |

Root project docs:

| File | Role |
|------|------|
| [../README.md](../README.md) | Product overview, access model, compliance |
| [../PRODUCTION.md](../PRODUCTION.md) | Production ship checklist |
| [../SECURITY.md](../SECURITY.md) | Vulnerability reporting and secrets handling |

---

## Application modules (read path)

| Path | Role |
|------|------|
| `lib/supabase/client.ts` | Browser client (anon key) |
| `lib/supabase/server.ts` | Server client (cookies / session) |
| `lib/supabase/admin.ts` | Service role — allowlist reject / privileged writes only |
| `lib/supabase/platform-api.ts` | Carts, bookings, issues, staff, restrictions |
| `lib/supabase/realtime.ts` | Live board subscriptions |
| `lib/supabase/mappers.ts` | Database row ↔ application types |
| `lib/auth/allowlist.ts` | Email allowlist checks |
| `app/auth/callback` | OAuth callback + allowlist gate |
| `app/auth/complete` | Session bridge to dashboard |

When Supabase environment variables are set, the app loads and writes platform data through Postgres. On production hosts, missing keys **hard-stop** the app instead of showing empty demo seed data.

---

## Allowlist rules (production)

Both conditions are required for access:

1. Google account domain is `@rbe.sk.ca`.
2. Exact email exists in `public.allowed_emails` with an assigned role (`teacher` | `admin`).

Example (replace with real staff; do not use personal Gmail):

```sql
insert into public.allowed_emails (email, role, name, employment_type) values
  ('first.last@rbe.sk.ca', 'admin', 'First Last', 'permanent')
on conflict (email) do update
  set role = excluded.role,
      name = excluded.name,
      employment_type = excluded.employment_type;
```

Offboard staff by deleting or disabling allowlist rows promptly so former employees cannot re-authenticate successfully.

---

## Environment variables

| Name | Client-visible? | Use |
|------|-----------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Authenticated browser access under RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Server-only privileged operations |

Never prefix the service role key with `NEXT_PUBLIC_`. Rotate immediately if leaked.

---

## Data classification (practical)

| Class | Examples | Handling |
|-------|----------|----------|
| **Staff identity** | Name, school email, avatar URL from Google | Access-controlled; needed for auth and board clarity |
| **Operational** | Bookings, cart status, restrictions, issues | School operational records; admin + relevant staff |
| **Access control** | `allowed_emails`, roles, employment type | IT-only configuration; audit offboarding |
| **Secrets** | Service role, OAuth client secret | Vault / Vercel env / Supabase dashboard only |

For privacy wording shown to users, see production **Privacy Policy** at `/legal/privacy`.
