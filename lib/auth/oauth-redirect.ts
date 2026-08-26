import { isSafeInternalPath } from "@/lib/auth/safe-path";
import { isProductionHostname, SITE_ORIGIN } from "@/lib/site";

/**
 * Build the post-OAuth return URL for Supabase `redirectTo`.
 *
 * Always prefer the page the staff is actually on (so www vs apex matches).
 * Never invent localhost from env when the user is already on a production host.
 *
 * Supabase still requires every returned URL to be listed under
 * Authentication → URL Configuration → Redirect URLs. If it is missing,
 * Supabase falls back to **Site URL** (often left as http://localhost:3000).
 */
export function getOAuthRedirectTo(
  path: string = "/auth/callback",
  next?: string,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  let origin = SITE_ORIGIN;
  if (typeof window !== "undefined") {
    const pageOrigin = window.location.origin;
    const host = window.location.hostname.toLowerCase();

    // Production hosts must never redirect OAuth back to localhost.
    if (isProductionHostname(host) || !host.includes("localhost")) {
      origin = pageOrigin;
    } else if (process.env.NODE_ENV === "development") {
      origin = pageOrigin;
    }
  }

  const url = new URL(normalizedPath, origin.endsWith("/") ? origin : `${origin}/`);
  if (isSafeInternalPath(next)) {
    url.searchParams.set("next", next);
  }
  return url.toString();
}
