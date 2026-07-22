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
| 3 | `seed-carts.sql` | 22 carts + high-issue trigger |

---

## 3. Allowlist real school emails

**Table Editor → `allowed_emails`**

| email | role | name |
|--------|------|------|
| `you@school.edu` | `admin` | Your Name |
| `teacher@school.edu` | `teacher` | Teacher Name |

Only these Google accounts can enter the app.

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
| Carts, bookings, issues | Postgres tables + RLS |
| Staff add (admin UI) | Inserts into `allowed_emails` |
| Local demo without keys | localStorage seed (legacy) |

---

## Production later

- Set Site URL + redirect URLs to your production domain  
- Add production redirect URI in Google Cloud  
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in the browser or git  
