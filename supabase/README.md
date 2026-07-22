# Supabase for Cubicle

See **[SETUP.md](./SETUP.md)** for the full ordered checklist.

## SQL files

| File | When |
|------|------|
| `schema.sql` | First — tables + RLS |
| `allowed-emails.sql` | Second — Google allowlist |
| `seed-carts.sql` | Third — 22 carts + high-issue trigger |

## App modules

| Path | Role |
|------|------|
| `lib/supabase/client.ts` | Browser client |
| `lib/supabase/server.ts` | Server client |
| `lib/supabase/admin.ts` | Service role (allowlist reject) |
| `lib/supabase/platform-api.ts` | CRUD for carts/bookings/issues |
| `lib/auth/allowlist.ts` | Email allowlist checks |
| `app/auth/callback` | OAuth + allowlist gate |
| `app/auth/complete` | Session bridge → dashboard |

When env keys are set, the app loads and writes platform data through Supabase instead of localStorage.
