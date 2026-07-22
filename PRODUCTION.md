# Cubicle production checklist

Use this before calling the site “ready” for staff.

## Access model

1. Only `@rbe.sk.ca` Google accounts may sign in.
2. Email must exist in Supabase `allowed_emails`.
3. Role comes from allowlist / profile (`teacher` | `admin`).
4. Gmail and all other domains are rejected in the auth callback.

## Vercel environment variables (exact names)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

- Do **not** use `NEXT_PUBLIC_` on the service role key.
- After changing any `NEXT_PUBLIC_*` variable, **Redeploy**.

## Supabase

Run (SQL Editor), in order if not already applied:

1. `supabase/schema.sql`
2. `supabase/allowed-emails.sql`
3. `supabase/seed-carts.sql`
4. `supabase/restrict-domain.sql`
5. `supabase/realtime.sql` — live bookings/carts/issues for all open browsers

Auth URL config:

- Site URL: `https://mycubicle.app`
- Redirect URLs include `https://mycubicle.app/auth/callback` and localhost for dev

Google provider: Client ID + Secret saved; hosted domain preference `rbe.sk.ca`.

## Google Cloud OAuth

- App type: **Web**
- Origins: `https://mycubicle.app`, `https://www.mycubicle.app`, `http://localhost:3000`
- Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
- External + Testing: add staff as Test users until published

## DNS

Per Vercel Domains panel (values may change):

- Apex `A` → Vercel IP
- `www` `CNAME` → Vercel target

SSL is handled by Vercel (not name.com certificates).

## Smoke test

- [ ] https://mycubicle.app loads
- [ ] `/login` shows Google only (no demo accounts)
- [ ] Allowlisted `@rbe.sk.ca` signs in
- [ ] Non-allowlisted `@rbe.sk.ca` blocked
- [ ] Gmail blocked
- [ ] Book cart, booking persists
- [ ] Two browsers: Teacher A books → Teacher B board updates without refresh
- [ ] Admin can open Maintenance
- [ ] Settings save name/photo
- [ ] Sign out works
- [ ] `/legal` pages load
- [ ] `/signup` redirects to login

## Security notes

- Repo should remain **private**.
- Never commit `.env.local`.
- Rotate service role key if it was ever exposed publicly.
