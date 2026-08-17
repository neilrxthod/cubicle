/**
 * Same-origin reverse proxy for Supabase Auth (OAuth authorize + callback).
 *
 * Staff should never see `<project-ref>.supabase.co` in the address bar or on
 * Google's "continue to …" account picker. `proxy.ts` forwards `/__supabase/*`
 * to the project and rewrites Google's `redirect_uri` onto this origin.
 *
 * Google Cloud must list:
 *   {origin}/__supabase/auth/v1/callback
 * as an Authorized redirect URI (keep the supabase.co callback too).
 */

export const SUPABASE_SAME_ORIGIN_PROXY_PREFIX = "/__supabase";

/**
 * Rewrite a Supabase project URL onto this app's origin for navigation.
 * Only rewrites hosts that match NEXT_PUBLIC_SUPABASE_URL.
 */
export function toSameOriginSupabaseUrl(supabaseUrl: string): string {
  if (typeof window === "undefined") return supabaseUrl;

  try {
    const target = new URL(supabaseUrl);
    const projectRaw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!projectRaw) return supabaseUrl;

    const project = new URL(projectRaw);
    if (target.hostname.toLowerCase() !== project.hostname.toLowerCase()) {
      return supabaseUrl;
    }

    return `${window.location.origin}${SUPABASE_SAME_ORIGIN_PROXY_PREFIX}${target.pathname}${target.search}${target.hash}`;
  } catch {
    return supabaseUrl;
  }
}
