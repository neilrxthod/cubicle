import { NextResponse } from "next/server";
import { finalizeSchoolLogin } from "@/lib/auth/finalize-login";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase PKCE callback (legacy Google provider hop).
 * First-party Google OAuth completes on /__supabase/auth/v1/callback.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("missing_code")}`,
    );
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchange failed:", exchangeError.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("auth_failed")}`,
    );
  }

  return finalizeSchoolLogin(origin, next);
}
