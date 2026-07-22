# Cubicle + Supabase — complete setup checklist

Do these steps **in order**. Skip any step you already finished.

## 1. Environment keys (local app)

Your `.env.local` should look like:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Get them from: **Project Settings → API**.  
Restart `npm run dev` after changing env vars.

---

## 2. Database SQL (run in SQL Editor)

Run each file fully, wait for **Success**:

| Order | File | Purpose |
|------:|------|---------|
| 1 | `schema.sql` | Tables, RLS, profile trigger |
| 2 | `allowed-emails.sql` | Google allowlist + role |
| 3 | `seed-carts.sql` | 22 carts + high-issue trigger (**safe re-run**; does not overwrite cart status) |
| 4 | `restrict-domain.sql` | Only `@rbe.sk.ca` on allowlist |
| 5 | `realtime.sql` | **Live multi-user board updates** |
| 6 | `employment-type.sql` | Permanent / sub / temp + blue tick |

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
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## 4. Google OAuth

### Google Cloud Console

1. [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create OAuth client ID** → **Web application**
3. Authorized redirect URI (exact):

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

(`YOUR_PROJECT_REF` is the subdomain in your Project URL.)

4. Copy **Client ID** and **Client Secret**

### Google Calendar sync (optional but recommended)

Cubicle can push bookings to each teacher's Google Calendar (**Settings → Google Calendar**).

1. In the **same Google Cloud project** as the OAuth client, enable **Google Calendar API**:
   - [APIs & Services → Library → Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) → **Enable**
2. OAuth consent screen:
   - Add scope: `https://www.googleapis.com/auth/calendar.events` (create/edit events on primary calendar only)
   - For school-only Workspace: set app to **Internal** if the project is under the board Google Workspace (avoids “unverified app” friction)
   - If **External + Testing**, add staff as test users
3. Teachers open **Settings → Connect Google Calendar**, approve Calendar access, then book as usual

**Without** enabling the API / scope, **Add to Calendar** buttons still work (opens Google’s “create event” template — no API).

Bell times for calendar events: `lib/calendar/period-schedule.ts` (timezone `America/Regina`).

#### Troubleshoot: `Error 400: access_not_configured`

Google message: *“You can't access this app until an admin at your institution reviews and configures access for it.”*

This is **not** a Cubicle code bug. School Google Workspace is blocking the Calendar OAuth scope.

| Who | Fix |
|-----|-----|
| **You (developer)** | 1. Same Cloud project as Supabase Google OAuth → enable [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com). 2. OAuth consent screen → **Edit app** → **Scopes** → add `https://www.googleapis.com/auth/calendar.events` → Save. 3. If consent is **Testing**, add your `@rbe.sk.ca` as a test user. 4. Prefer **User type: Internal** if the Cloud project is owned by the board Workspace. |
| **Board Google admin** | Admin console → **Security** → **Access and data control** → **API controls** → **Manage third-party app access** (or App access control). Find the Cubicle OAuth client (by Client ID / name) → set to **Trusted** or allow **Calendar** scope. Until then, school accounts cannot grant Calendar. |
| **Workaround now** | Use **Add to Calendar** on a booking (no extra OAuth). Regular Cubicle login is unaffected. |

Copy Client ID from: Google Cloud → APIs & Services → Credentials → OAuth 2.0 Client (the one pasted into Supabase).

### Supabase Dashboard

1. **Authentication → Providers → Google** → Enable  
2. Paste Client ID + Secret → Save  
3. **Authentication → URL configuration**
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:**  
     `http://localhost:3000/auth/callback`  
     `http://localhost:3000/**`

---

## 5. Smoke test

1. `npm run dev` → open http://localhost:3000/login  
2. **Continue with Google** with an **allowlisted** account → land on board  
3. Confirm carts load (Oak, Maple, …)  
4. Create a booking → refresh → still there  
5. Sign out → sign in with a **non-allowlisted** Google account → blocked  
6. (Admin) open Maintenance → manage carts / staff allowlist  

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
| Carts, bookings, issues | Postgres tables + RLS |
| Staff add (admin UI) | Inserts into `allowed_emails` |
| Local demo without keys | localStorage seed (legacy) |

---

## Production later

- Set Site URL + redirect URLs to your production domain  
- Add production redirect URI in Google Cloud  
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in the browser or git  
