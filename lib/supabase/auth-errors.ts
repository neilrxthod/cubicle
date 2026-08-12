/**
 * Helpers for unrecoverable Supabase Auth session errors (stale cookies).
 *
 * When a refresh token is revoked, rotated, or missing server-side, the browser
 * still holds `sb-*-auth-token` cookies. Every middleware/client refresh then
 * logs AuthApiError: refresh_token_not_found until those cookies are cleared.
 */

type AuthLikeError = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
  name?: string | null;
};

/** Errors that mean the stored session can never be refreshed — clear cookies. */
export function isUnrecoverableAuthError(
  error: unknown,
): error is AuthLikeError {
  if (!error || typeof error !== "object") return false;

  const err = error as AuthLikeError;
  const code = (err.code ?? "").toLowerCase();
  const message = (err.message ?? "").toLowerCase();

  if (
    code === "refresh_token_not_found" ||
    code === "refresh_token_already_used" ||
    code === "session_not_found" ||
    code === "bad_jwt" ||
    code === "user_not_found" ||
    code === "session_expired"
  ) {
    return true;
  }

  if (
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token already used") ||
    message.includes("session from session_id claim in jwt does not exist") ||
    message.includes("invalid jwt")
  ) {
    return true;
  }

  return false;
}

/** Cookie names written by @supabase/ssr for the auth session (incl. chunks). */
export function isSupabaseAuthCookieName(name: string): boolean {
  // Primary session cookie + chunked forms: sb-<ref>-auth-token, .0, .1, …
  // Also code-verifier used during PKCE.
  return (
    name.startsWith("sb-") &&
    (name.includes("-auth-token") || name.endsWith("-code-verifier"))
  );
}
