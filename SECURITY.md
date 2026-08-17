# Security Policy

Cubicle is a **private school staff application**. It is not a public SaaS product. Access is limited to allowlisted `@rbe.sk.ca` Google accounts.

## Supported deployment

| Surface | Status |
|---------|--------|
| Production (`mycubicle.app`, configured Vercel project) | Supported |
| Staging / preview (`*.vercel.app` with Supabase configured) | Supported for IT testing |
| Localhost demo without Supabase | Local development only — **not** production data |
| Forks / redistributed builds | Not supported |

Always run the latest `main` deploy with current Supabase schema migrations applied.

## Access model

1. **School Google only** — email domain must be `@rbe.sk.ca`.
2. **Allowlist** — exact email must exist in Supabase `allowed_emails`.
3. **Roles** — `teacher` or `admin` from allowlist / profile.
4. **Service role** — `SUPABASE_SERVICE_ROLE_KEY` is server-only; never prefix with `NEXT_PUBLIC_`.
5. **RLS** — Postgres Row Level Security backs table access; the browser uses the publishable / anon key only.
6. **Demo login** — disabled unless `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` (must never be set on Vercel production).
7. **Camera** — phone QR scan uses the device camera. `Permissions-Policy` allows `camera=(self)` only.

More detail: [README — Access control & security](./README.md#access-control--security), [PRODUCTION.md](./PRODUCTION.md), in-app `/legal/security`.

## Data durability

School bookings, carts, laptop codes, issues, staff, shares, and restrictions live in **Supabase Postgres**. GitHub pushes and Vercel redeploys replace application code only — they do **not** wipe the database.

See [`supabase/DATA_DURABILITY.md`](./supabase/DATA_DURABILITY.md).

## Reporting a vulnerability

If you believe you have found a security issue in Cubicle (auth bypass, data exposure, injection, privilege escalation, leaked secrets, etc.):

1. **Do not** open a public GitHub issue for exploit details.
2. Contact the repository owner / school IT operator privately (project maintainer on the private GitHub repo).
3. Include:
   - Description of the issue and impact
   - Steps to reproduce (or proof-of-concept without destructive payloads)
   - Affected URL / environment (production vs local)
   - Your contact details for follow-up

### What to expect

- Acknowledgement when the report is received (best effort for a private school project).
- Fix or mitigation prioritized by severity (auth/data exposure first).
- Credit on request after a fix is deployed, unless you prefer to remain anonymous.

### Out of scope (examples)

- Issues that only affect misconfigured local demo mode
- Social engineering of school Google Workspace admins
- Vulnerabilities in third-party services (Supabase, Vercel, Google) that should be reported upstream
- Missing optional features (e.g. Calendar not connected)

## Secrets handling

| Secret | Storage |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel / `.env.local` only |
| `BREVO_API_KEY` | Vercel / `.env.local` only |
| Google OAuth client secret | Supabase Auth provider config / Google Cloud |
| Staff passwords | Not used for production Google sign-in |

If a secret may have been committed or shared:

1. Rotate it immediately in Supabase / Google Cloud / Vercel.
2. Redeploy the app.
3. Review Auth logs and `allowed_emails` for unexpected access.

## Preferred hardening checklist

- [ ] Repo remains **private**
- [ ] Production env has Supabase keys + no demo login
- [ ] Supabase Auth redirect URLs match production only (+ local for dev)
- [ ] Google OAuth client restricted to school / internal consent where possible
- [ ] Offboarded staff removed from `allowed_emails`
- [ ] Later additive SQL applied (`restrict-domain.sql`, `employment-type.sql`, share / QR / notify files — see `supabase/README.md`)
