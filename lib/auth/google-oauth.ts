import { NextResponse, type NextRequest } from "next/server";
import {
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
} from "@/lib/auth/google-oauth-guard";
import {
  cookieBase,
  googleOAuthRedirectUri,
} from "@/lib/auth/google-oauth-start";
import { finalizeSchoolLogin } from "@/lib/auth/finalize-login";
import { createClient } from "@/lib/supabase/server";

export { isGoogleOAuthConfigured, isOurGoogleOAuthCallback } from "@/lib/auth/google-oauth-guard";
export { startGoogleOAuth, googleOAuthRedirectUri } from "@/lib/auth/google-oauth-start";

const STATE_COOKIE = GOOGLE_OAUTH_STATE_COOKIE;
const VERIFIER_COOKIE = GOOGLE_OAUTH_VERIFIER_COOKIE;
const NEXT_COOKIE = GOOGLE_OAUTH_NEXT_COOKIE;

function clearOAuthCookies(response: NextResponse, secure: boolean) {
  const expire = { ...cookieBase(secure), maxAge: 0 };
  response.cookies.set(STATE_COOKIE, "", expire);
  response.cookies.set(VERIFIER_COOKIE, "", expire);
  response.cookies.set(NEXT_COOKIE, "", expire);
}

export async function completeGoogleOAuth(
  request: NextRequest,
): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const secure = origin.startsWith("https://");
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");

  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;
  const next = request.cookies.get(NEXT_COOKIE)?.value ?? null;

  if (oauthError) {
    const response = NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        oauthError === "access_denied" ? "access_denied" : "auth_failed",
      )}`,
    );
    clearOAuthCookies(response, secure);
    return response;
  }

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    const response = NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("missing_code")}`,
    );
    clearOAuthCookies(response, secure);
    return response;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = googleOAuthRedirectUri(origin);

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });

  let idToken = "";
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await tokenRes.json()) as {
      id_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !payload.id_token) {
      console.error(
        "[google-oauth] token exchange failed",
        payload.error,
        payload.error_description,
      );
      const response = NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("auth_failed")}`,
      );
      clearOAuthCookies(response, secure);
      return response;
    }
    idToken = payload.id_token;
  } catch (err) {
    console.error("[google-oauth] token exchange error", err);
    const response = NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("auth_failed")}`,
    );
    clearOAuthCookies(response, secure);
    return response;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) {
    console.error("[google-oauth] signInWithIdToken", error.message);
    const response = NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("auth_failed")}`,
    );
    clearOAuthCookies(response, secure);
    return response;
  }

  const finished = await finalizeSchoolLogin(origin, next, data.user);
  clearOAuthCookies(finished, secure);
  return finished;
}
