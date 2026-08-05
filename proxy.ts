import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Same-origin Supabase proxy (OAuth authorize) — do not touch session cookies.
  if (pathname.startsWith("/__supabase")) {
    return NextResponse.next();
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
     * Match all request paths except static assets, images, and the
     * same-origin Supabase OAuth proxy.
     */
    "/((?!_next/static|_next/image|favicon.ico|__supabase/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
