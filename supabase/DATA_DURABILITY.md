# Data durability — school data survives every deploy

## The rule

| What | Where it lives | Survives `git push` / Vercel redeploy? |
|------|----------------|----------------------------------------|
| Bookings | Supabase Postgres | **Yes** |
| Carts & maintenance status | Supabase Postgres | **Yes** |
| Issues | Supabase Postgres | **Yes** |
| Staff allowlist & roles | Supabase Postgres | **Yes** |
| Slot restrictions & policy | Supabase Postgres | **Yes** |
| Swap requests | Supabase Postgres | **Yes** |
| Profiles (name, photo, prefs) | Supabase Postgres | **Yes** |
| App UI / code / integrations | GitHub → Vercel | Replaced on deploy (by design) |
| Browser cache / demo seed | User’s browser only | Not source of truth |

**Pushing code never deletes school data.**  
Vercel only hosts the Next.js app. The database is a separate Supabase project.

```
Teachers use mycubicle.app  →  Vercel (code)  →  Supabase (data)
                                    ↑                    ↑
                              git push updates     stays forever
```

## What we guarantee in the app

1. **Production requires Supabase**  
   On `mycubicle.app`, `*.vercel.app`, or `VERCEL_ENV=production`, the app **refuses** to run as a localStorage demo. Misconfigured env shows an error instead of empty fake data.

2. **Writes go to Postgres when configured**  
   Book / cancel / issues / staff / restrictions all use Supabase when env vars are set.

3. **Local demo is isolated**  
   Demo mode (no Supabase keys, localhost only) uses browser storage. That path is **blocked** on production hosts so demo and real data never mix.

4. **SQL is additive**  
   - `schema.sql` uses `create table if not exists`  
   - `seed-carts.sql` does **not** overwrite cart `status` on re-run  
   - Never run `drop table` / `truncate` on production without an explicit backup plan

5. **Sign-out only clears the browser cache**  
   It does not delete rows in Supabase.

## Operator checklist (every release)

- [ ] Vercel Production has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Same Supabase **project** as before the deploy (don’t point prod at a new empty project by accident)
- [ ] Optional: set `NEXT_PUBLIC_CUBICLE_REQUIRE_REMOTE=true` on Production for an extra hard lock
- [ ] After deploy: sign in → confirm today’s bookings still appear
- [ ] **Do not** create a new Supabase project and paste new keys unless you intend a full migration

## Safe vs unsafe SQL

| Safe | Unsafe |
|------|--------|
| `create table if not exists` | `drop table …` |
| `alter table … add column if not exists` | `truncate bookings` |
| `seed-carts.sql` (status preserved) | Re-seed that forces `status = active` on all carts |
| Insert allowlist emails | Delete all from `allowed_emails` |

## Backups (recommended for school production)

In Supabase Dashboard:

1. **Project Settings → Database → Backups** (Pro plan: daily; Free: use logical dump)  
2. Or schedule:

```bash
# Example logical backup (run with your DB URL from Supabase settings)
pg_dump "$DATABASE_URL" --format=custom -f cubicle-$(date +%Y%m%d).dump
```

3. Before any risky schema change: take a backup, then apply additive SQL only.

## If data “looks empty” after a deploy

It is almost never a wipe. Check:

1. Wrong Supabase project keys on Vercel (pointing at empty project)  
2. RLS / signed-out session  
3. Browser still showing an error state — use **Retry**  
4. You are on localhost without env (demo seed), not production  

School rows remain in Supabase Table Editor → `bookings`, `carts`, `allowed_emails`.

## Schema changes from new features

When code needs a new column/table:

1. Write additive SQL under `supabase/` (never destructive by default)  
2. Run it **once** in Supabase SQL Editor on the production project  
3. Deploy the app that uses the new field  
4. Old data remains; new columns use defaults/nulls as designed
