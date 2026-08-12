import { isSupabaseAuthCookieName } from "@/lib/supabase/auth-errors";

/**
 * Expire Supabase auth cookies in the browser.
 *
 * Needed when `auth.signOut()` cannot load the session (e.g. refresh token
 * already gone server-side) and therefore never clears storage itself.
 */
export function clearBrowserAuthCookies(): void {
  if (typeof document === "undefined") return;

  const parts = document.cookie.split("; ");
  for (const part of parts) {
    const eq = part.indexOf("=");
    const name = eq >= 0 ? part.slice(0, eq) : part;
    if (!name || !isSupabaseAuthCookieName(name)) continue;

    // Host-only clear (matches default @supabase/ssr cookie options).
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;

    // Best-effort parent-domain clear if the app ever set Domain=…
    const host = window.location.hostname;
    if (host && host.includes(".")) {
      document.cookie = `${name}=; path=/; max-age=0; samesite=lax; domain=${host}`;
      document.cookie = `${name}=; path=/; max-age=0; samesite=lax; domain=.${host}`;
    }
  }
}
