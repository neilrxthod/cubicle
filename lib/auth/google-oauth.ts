import { NextResponse, type NextRequest } from "next/server";
import {
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  isGoogleOAuthConfigured,
} from "@/lib/auth/google-oauth-guard";
import { GOOGLE_HOSTED_DOMAIN } from "@/lib/auth/school-domain";
import { SUPABASE_SAME_ORIGIN_PROXY_PREFIX } from "@/lib/auth/oauth-proxy";
import {
  isBrowserSafeOAuthRedirect,
  rewriteGoogleRedirectUri,
} from "@/lib/auth/oauth-supabase-proxy";
import { isSafeInternalPath } from "@/lib/auth/safe-path";
import { finalizeSchoolLogin } from "@/lib/auth/finalize-login";
import { createClient } from "@/lib/supabase/server";

export { isGoogleOAuthConfigured, isOurGoogleOAuthCallback } from "@/lib/auth/google-oauth-guard";

const STATE_COOKIE = GOOGLE_OAUTH_STATE_COOKIE;
const VERIFIER_COOKIE = GOOGLE_OAUTH_VERIFIER_COOKIE;
const NEXT_COOKIE = GOOGLE_OAUTH_NEXT_COOKIE;
const COOKIE_MAX_AGE = 10 * 60;

export function googleOAuthRedirectUri(origin: string): string {
  return `${origin}${SUPABASE_SAME_ORIGIN_PROXY_PREFIX}/auth/v1/callback`;
}

function cookieBase(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

function clearOAuthCookies(response: NextResponse, secure: boolean) {
  const expire = { ...cookieBase(secure), maxAge: 0 };
  response.cookies.set(STATE_COOKIE, "", expire);
  response.cookies.set(VERIFIER_COOKIE, "", expire);
  response.cookies.set(NEXT_COOKIE, "", expire);
}

function randomUrlSafe(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Buffer.from(digest)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function startGoogleOAuth(
  request: NextRequest,
): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const next = request.nextUrl.searchParams.get("next");
  const secure = origin.startsWith("https://");

  if (!isGoogleOAuthConfigured()) {
    return startSupabaseGoogleOAuth(origin, next);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!.trim();
  const state = randomUrlSafe(24);
  const verifier = randomUrlSafe(32);
  const challenge = await sha256Base64Url(verifier);
  const redirectUri = googleOAuthRedirectUri(origin);

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", clientId);
  google.searchParams.set("redirect_uri", redirectUri);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("code_challenge", challenge);
  google.searchParams.set("code_challenge_method", "S256");
  google.searchParams.set("hd", GOOGLE_HOSTED_DOMAIN);
  google.searchParams.set("prompt", "select_account");
  google.searchParams.set("access_type", "online");

  const response = NextResponse.redirect(google.toString());
  const opts = cookieBase(secure);
  response.cookies.set(STATE_COOKIE, state, opts);
  response.cookies.set(VERIFIER_COOKIE, verifier, opts);
  if (isSafeInternalPath(next)) {
    response.cookies.set(NEXT_COOKIE, next, opts);
  }
  return response;
}

async function startSupabaseGoogleOAuth(
  origin: string,
  next: string | null,
): Promise<NextResponse> {
  const supabase = await createClient();
  const redirectTo = new URL("/auth/callback", origin);
  if (isSafeInternalPath(next)) {
    redirectTo.searchParams.set("next", next);
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
      skipBrowserRedirect: true,
      queryParams: {
        hd: GOOGLE_HOSTED_DOMAIN,
        prompt: "select_account",
      },
    },
  });
  if (error || !data?.url) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("auth_failed")}`,
    );
  }
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "").trim() ?? "";
  const target = rewriteGoogleRedirectUri(data.url, origin, project);
  if (!isBrowserSafeOAuthRedirect(target, origin)) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("auth_failed")}`,
    );
  }
  return NextResponse.redirect(target);
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
