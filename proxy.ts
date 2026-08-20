import { NextResponse, type NextRequest } from "next/server";
import { isOurGoogleOAuthCallback } from "@/lib/auth/google-oauth-guard";
import { proxySupabaseAuth } from "@/lib/auth/oauth-supabase-proxy";
import { updateSession } from "@/lib/supabase/middleware";

/** Handshake routes set their own session. Do not call getUser() first. */
function isAuthHandshake(pathname: string) {
  return pathname === "/auth/google" || pathname === "/auth/callback";
}

function passthrough(request: NextRequest) {
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/__supabase")) {
    if (isOurGoogleOAuthCallback(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/google";
      return NextResponse.redirect(url);
    }
    return proxySupabaseAuth(request);
  }

  // Supabase Site URL fallback can land OAuth on `/` with ?code=…
  // Always finish the PKCE exchange on the dedicated callback route.
  if (pathname === "/" && searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  if (isAuthHandshake(pathname)) {
    return passthrough(request);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and images.
     * /__supabase is included so OAuth can hide *.supabase.co from Google.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
