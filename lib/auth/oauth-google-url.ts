import { isGoogleOAuthConfigured } from "@/lib/auth/google-oauth-guard";
import { SUPABASE_SAME_ORIGIN_PROXY_PREFIX } from "@/lib/auth/oauth-proxy";

function isGoogleAccountsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "accounts.google.com" ||
    host.endsWith(".google.com") ||
    host.endsWith(".googleusercontent.com")
  );
}

function sameHost(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function isSupabaseProjectHost(hostname: string, projectOrigin: string) {
  try {
    return sameHost(hostname, new URL(projectOrigin).hostname);
  } catch {
    return false;
  }
}

/**
 * Point Google's OAuth redirect_uri at this app so the account picker
 * shows mycubicle.app instead of <ref>.supabase.co.
 */
export function rewriteGoogleRedirectUri(
  location: string,
  publicOrigin: string,
  projectOrigin: string,
): string {
  let url: URL;
  try {
    url = new URL(location, publicOrigin);
  } catch {
    return location;
  }

  if (isGoogleAccountsHost(url.hostname)) {
    if (!isGoogleOAuthConfigured() || !projectOrigin) {
      return url.toString();
    }
    const raw = url.searchParams.get("redirect_uri");
    if (!raw) return url.toString();
    try {
      const redirect = new URL(raw);
      if (isSupabaseProjectHost(redirect.hostname, projectOrigin)) {
        url.searchParams.set(
          "redirect_uri",
          `${publicOrigin}${SUPABASE_SAME_ORIGIN_PROXY_PREFIX}${redirect.pathname}`,
        );
      }
    } catch {
      return url.toString();
    }
    return url.toString();
  }

  if (isSupabaseProjectHost(url.hostname, projectOrigin)) {
    return `${publicOrigin}${SUPABASE_SAME_ORIGIN_PROXY_PREFIX}${url.pathname}${url.search}${url.hash}`;
  }

  return url.toString();
}

/** True when a 302 target will not put *.supabase.co in the tab. */
export function isBrowserSafeOAuthRedirect(
  location: string,
  publicOrigin: string,
): boolean {
  try {
    const url = new URL(location, publicOrigin);
    if (url.origin === new URL(publicOrigin).origin) return true;
    return isGoogleAccountsHost(url.hostname);
  } catch {
    return false;
  }
}
