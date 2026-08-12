import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSupabaseAuthCookieName,
  isUnrecoverableAuthError,
} from "@/lib/supabase/auth-errors";

/**
 * Refresh the Supabase session on each matched request (used by proxy.ts).
 *
 * If the refresh token in cookies is gone/revoked server-side, clear those
 * cookies so we stop retrying every request (AuthApiError spam + stuck UI).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return supabaseResponse;
  }

  // No auth cookies → nothing to refresh (avoids needless Auth client work).
  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => isSupabaseAuthCookieName(cookie.name));
  if (!hasAuthCookie) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Important: do not remove getUser() — it revalidates the JWT / refreshes.
  const { error } = await supabase.auth.getUser();

  if (error && isUnrecoverableAuthError(error)) {
    // signOut often fails when the refresh token is already invalid
    // (session load returns AuthApiError and bails). Always expire cookies.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore — manual clear below
    }
    clearAuthCookies(request, supabaseResponse);
  }

  return supabaseResponse;
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  const expire = {
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
  };

  for (const cookie of request.cookies.getAll()) {
    if (!isSupabaseAuthCookieName(cookie.name)) continue;
    // Clear host-only and common domain variants the browser may still send.
    response.cookies.set(cookie.name, "", expire);
    request.cookies.set(cookie.name, "");
  }
}
