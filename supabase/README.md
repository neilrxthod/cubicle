# Supabase for Cubicle

See **[SETUP.md](./SETUP.md)** for the full ordered checklist.  
Data survives every deploy: **[DATA_DURABILITY.md](./DATA_DURABILITY.md)**.

## SQL files (run in order)

| Order | File | When |
|------:|------|------|
| 1 | `schema.sql` | First — tables, RLS, profile trigger |
| 2 | `allowed-emails.sql` | Google allowlist + admin policies |
| 3 | `seed-carts.sql` | Laptop carts (**safe re-run**; does not overwrite cart status) |
| 4 | `restrict-domain.sql` | DB enforces `@rbe.sk.ca` on allowlist |
| 5 | `realtime.sql` | Live multi-user board (Realtime publication) |
| 6 | `employment-type.sql` | Permanent / substitute / temporary + verified tick |
| 7 | `profile-name-sync.sql` | Fan-out Google/profile display name to bookings, issues, swaps |

## Docs

| File | Role |
|------|------|
| [SETUP.md](./SETUP.md) | End-to-end Supabase + Google OAuth + Calendar checklist |
| [DATA_DURABILITY.md](./DATA_DURABILITY.md) | Why `git push` never wipes school data |

## App modules

| Path | Role |
|------|------|
| `lib/supabase/client.ts` | Browser client |
| `lib/supabase/server.ts` | Server client (cookies) |
| `lib/supabase/admin.ts` | Service role (allowlist reject / privileged writes) |
| `lib/supabase/platform-api.ts` | CRUD for carts, bookings, issues, staff, restrictions |
| `lib/supabase/realtime.ts` | Live board subscriptions |
| `lib/supabase/mappers.ts` | DB row ↔ app types |
| `lib/auth/allowlist.ts` | Email allowlist checks |
| `app/auth/callback` | OAuth + allowlist gate |
| `app/auth/complete` | Session bridge → dashboard |

When env keys are set, the app loads and writes platform data through Supabase instead of browser-local demo storage. On production hosts, missing keys hard-stop the app rather than showing empty seed data.
