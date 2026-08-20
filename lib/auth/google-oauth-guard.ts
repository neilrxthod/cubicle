import type { NextRequest } from "next/server";

/** PKCE state cookie set by first-party Google OAuth start. */
export const GOOGLE_OAUTH_STATE_COOKIE = "cubicle_ga_state";
export const GOOGLE_OAUTH_VERIFIER_COOKIE = "cubicle_ga_verifier";
export const GOOGLE_OAUTH_NEXT_COOKIE = "cubicle_ga_next";

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
  );
}

/**
 * True when Google is returning to our same-origin callback with a
 * first-party OAuth state cookie. Kept tiny so `proxy.ts` can import it
 * without pulling the token-exchange / login stack.
 */
export function isOurGoogleOAuthCallback(request: NextRequest): boolean {
  if (!isGoogleOAuthConfigured()) return false;
  if (!request.nextUrl.pathname.endsWith("/auth/v1/callback")) return false;
  return Boolean(request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value);
}
