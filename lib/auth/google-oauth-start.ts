import { NextResponse, type NextRequest } from "next/server";
import {
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  isGoogleOAuthConfigured,
} from "@/lib/auth/google-oauth-guard";
import { SUPABASE_SAME_ORIGIN_PROXY_PREFIX } from "@/lib/auth/oauth-proxy";
import { isSafeInternalPath } from "@/lib/auth/safe-path";
import { GOOGLE_HOSTED_DOMAIN } from "@/lib/auth/school-domain";

const STATE_COOKIE = GOOGLE_OAUTH_STATE_COOKIE;
const VERIFIER_COOKIE = GOOGLE_OAUTH_VERIFIER_COOKIE;
const NEXT_COOKIE = GOOGLE_OAUTH_NEXT_COOKIE;
const COOKIE_MAX_AGE = 10 * 60;

export function googleOAuthRedirectUri(origin: string): string {
  return `${origin}${SUPABASE_SAME_ORIGIN_PROXY_PREFIX}/auth/v1/callback`;
}

export function cookieBase(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
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
  const redirectTo = new URL("/auth/callback", origin);
  if (isSafeInternalPath(next)) {
    redirectTo.searchParams.set("next", next);
  }
  const project =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "").trim() ?? "";
  if (!project) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("auth_failed")}`,
    );
  }

  const verifier = randomUrlSafe(32);
  const challenge = await sha256Base64Url(verifier);
  const authorize = new URL(`${project}/auth/v1/authorize`);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", redirectTo.toString());
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("hd", GOOGLE_HOSTED_DOMAIN);
  authorize.searchParams.set("prompt", "select_account");

  // Supabase SSR stores PKCE values as base64url-encoded JSON in this cookie.
  const projectRef = new URL(project).hostname.split(".")[0];
  const verifierCookie = `sb-${projectRef}-auth-token-code-verifier`;
  const response = NextResponse.redirect(
    `${origin}${SUPABASE_SAME_ORIGIN_PROXY_PREFIX}${authorize.pathname}${authorize.search}`,
  );
  response.cookies.set(
    verifierCookie,
    `base64-${Buffer.from(JSON.stringify(verifier)).toString("base64url")}`,
    cookieBase(origin.startsWith("https://")),
  );
  return response;
}
