# Cubicle + Supabase — complete setup checklist

Do these steps **in order**. Skip any step you already finished.

## 1. Environment keys (local app)

Copy [`.env.local.example`](../.env.local.example). The required names are:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # legacy JWT — still works if publishable is unset
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Get them from: **Project Settings → API**. Prefer the **publishable** key (`sb_publishable_…`).  
Restart `npm run dev` after changing env vars.

---

## 2. Database SQL (run in SQL Editor)

Run each file fully, wait for **Success**:

| Order | File | Purpose |
|------:|------|---------|
| 1 | `schema.sql` | Tables, RLS, profile trigger |
| 2 | `allowed-emails.sql` | Google allowlist + role |
| 3 | `seed-carts.sql` | Laptop carts (**safe re-run**; does not overwrite cart status) |
| 4 | `restrict-domain.sql` | Only `@rbe.sk.ca` on allowlist |
| 5 | `realtime.sql` | **Live multi-user board and presence** |
| 6 | `employment-type.sql` | Permanent / sub / temp + blue tick |
| 7 | `profile-name-sync.sql` | Display-name fan-out to operational rows |
| 8 | `booking-last-editor.sql` | Last-editor metadata on bookings |
| 9 | `swap-accept.sql` | **Two-way cart swap accept** (owners can accept; both slots exchange) |
| 10 | `booking-policy-max-slots.sql` | Max cart slots per teacher per day |
| 11 | `booking-share.sql` | Share / borrow columns on bookings |
| 12 | `booking-share-resolve.sql` | Teachers can accept / decline share invites |
| 13 | `booking-share-declined.sql` | Owner notice when an invitee declines |
| 14 | `cart-laptop-brand.sql` | Dell / Chromebook fleet on inventory carts |
| 15 | `cart-laptop-codes.sql` | Laptop case codes for QR labels |
| 16 | `cart-sort-order.sql` | Admin drag-and-drop cart order |
| 17 | `issues-delete.sql` | Allow reporters/admins to **delete issues** from Postgres |
| 18 | `notify-email.sql` | Profile email notification toggles |

Existing project that skipped later files: run **`repair-live.sql` once** (laptop codes + last-editor columns + swap accept/decline RPCs). Full index: [`README.md`](./README.md).

**Durability:** App deploys never touch this data. See [`DATA_DURABILITY.md`](./DATA_DURABILITY.md).  
Never `drop table` / `truncate` on a live school project without a backup.

---

## 3. Allowlist real school emails (@rbe.sk.ca only)

Run `restrict-domain.sql` so the DB rejects non-school emails.

**Table Editor → `allowed_emails`**

| email | role | name |
|--------|------|------|
| `you@rbe.sk.ca` | `admin` | Your Name |
| `teacher@rbe.sk.ca` | `teacher` | Teacher Name |

**Rules (both required):**
1. Domain must be `@rbe.sk.ca` (Gmail and other domains blocked)
2. Exact email must be on this allowlist

Vercel env var names (exact spelling):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted if the publishable key is not set.

---

## 4. Google OAuth

### Google Cloud Console

1. [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create OAuth client ID** → **Web application**
3. Authorized redirect URIs (exact):

```text
https://www.mycubicle.app/__supabase/auth/v1/callback
https://mycubicle.app/__supabase/auth/v1/callback
http://localhost:3000/__supabase/auth/v1/callback
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

The `mycubicle.app/__supabase/…` URIs hide `*.supabase.co` on Google’s account picker. Keep the supabase.co URI as fallback. (`YOUR_PROJECT_REF` is the subdomain in your Project URL.)

4. Copy **Client ID** and **Client Secret**

Bell times used on the schedule board live in `lib/calendar/period-schedule.ts` (timezone `America/Regina`). Cubicle does **not** currently push bookings into Google Calendar.

### Supabase Dashboard

1. **Authentication → Providers → Google** → Enable  
2. Paste Client ID + Secret → Save  
3. **Authentication → URL configuration**  
   Open: [Auth URL Configuration](https://supabase.com/dashboard/project/bpfwgfecydqxbkdhobqb/auth/url-configuration)

#### Production (required for mycubicle.app — do this first)

If **Site URL** is still `http://localhost:3000`, Google sign-in from production
sends staff to localhost (`ERR_CONNECTION_REFUSED`). Fix:

| Setting | Value |
|---------|--------|
| **Site URL** | `https://www.mycubicle.app` |
| **Redirect URLs** (add all) | `https://www.mycubicle.app/auth/callback` |
| | `https://www.mycubicle.app/**` |
| | `https://mycubicle.app/auth/callback` |
| | `https://mycubicle.app/**` |
| | `http://localhost:3000/auth/callback` (local dev) |
| | `http://localhost:3000/**` (local dev) |

Optional later: `https://mycubicle.com/**` and `https://www.mycubicle.com/**` after DNS is on Vercel.

Save, then try **Continue with Google** again on production (old `?code=` links expire).

#### Local-only project (dev sandbox only)

Only if this Supabase project is **never** used on Vercel:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** `http://localhost:3000/auth/callback`, `http://localhost:3000/**`

---

## 5. Official school go-live (empty start)

1. In Supabase **SQL Editor**, run [`clear-operational-data.sql`](./clear-operational-data.sql) once.  
   That removes all carts, bookings, issues, locks, and swaps.  
   **Keeps** allowlisted staff emails and profiles.  
2. Hard-refresh Cubicle (or redeploy) so browser cache drops.  
3. **Admin → Inventory → Add cart** for each real laptop cart.  
4. Teachers book from **Schedule**.

## 6. Smoke test

1. **Production:** open https://www.mycubicle.app/login → Google → must stay on mycubicle.app (never localhost)  
2. **Local:** `npm run dev` → http://localhost:3000/login with allowlisted account  
3. Confirm the schedule loads empty (no sample carts) until you add inventory  
4. Create a booking → refresh → still there  
5. Sign out → sign in with a **non-allowlisted** Google account → blocked  
6. (Admin) Inventory → add carts / Staff allowlist; use **Reset data** only if you need another empty wipe  


---

## How the pieces connect

```text
Google identity
    → Supabase Auth session
    → allowlist check (allowed_emails)
    → profiles.role (teacher | admin)
    → RLS on carts / bookings / issues
    → Cubicle UI
```

| Feature | Backed by |
|---------|-----------|
| Sign-in | Google + Supabase Auth |
| Who may enter | `allowed_emails` |
| Role | `allowed_emails.role` → `profiles.role` |
| Employment / blue tick | `employment_type` (`permanent` = verified) — run `employment-type.sql` |
| Carts, bookings, issues, shares | Postgres tables + RLS |
| Laptop brands / QR codes | `laptop_brand`, `laptop_codes` on `carts` |
| Staff add (admin UI) | Inserts into `allowed_emails` |
| Local demo without keys | Browser sandbox (never production data) |

---

## Production later

- Set Site URL + redirect URLs to your production domain  
- Add production redirect URI in Google Cloud  
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in the browser or git  
