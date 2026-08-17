import { NextResponse, type NextRequest } from "next/server";
import { proxySupabaseAuth } from "@/lib/auth/oauth-supabase-proxy";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Same-origin Supabase Auth proxy — hides *.supabase.co from Google.
  if (pathname.startsWith("/__supabase")) {
    return proxySupabaseAuth(request);
  }

  // Supabase Site URL fallback can land OAuth on `/` with ?code=…
  // Always finish the PKCE exchange on the dedicated callback route.
  if (pathname === "/" && searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
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
