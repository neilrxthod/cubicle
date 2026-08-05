/**
 * Same-origin reverse proxy for Supabase Auth (OAuth authorize hop).
 *
 * Staff should never see `<project-ref>.supabase.co` in the address bar when
 * they click Continue with Google. Next.js rewrites `/__supabase/*` to the
 * real project URL server-side (see next.config.ts).
 *
 * Note: After Google consent, Google still redirects to Supabase's registered
 * callback (`…supabase.co/auth/v1/callback`) before bouncing back to this app.
 * Hiding that hop requires a Supabase custom domain.
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
