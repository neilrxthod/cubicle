import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteUnauthorizedUser,
  getAllowedEmail,
} from "@/lib/auth/allowlist";
import { getDashboardPath } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";

/**
 * Google OAuth returns here with ?code=...
 * 1. Exchange code for a Supabase session
 * 2. Allowlist check — reject if email is not pre-approved
 * 3. Sync profile role from allowlist
 * 4. Hand off to /auth/complete to set the app session cookie/localStorage bridge
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("no_email")}`,
    );
  }

  let allowed;
  try {
    allowed = await getAllowedEmail(user.email);
  } catch {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("allowlist_error")}`,
    );
  }

  if (!allowed) {
    // Not on the school list — kick them out and remove the auth user.
    const userId = user.id;
    await supabase.auth.signOut();
    await deleteUnauthorizedUser(userId);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("not_allowed")}`,
    );
  }

  const role = allowed.role as UserRole;
  const name =
    allowed.name ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email.split("@")[0];

  // Keep profile role/name in sync with the allowlist.
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      name,
      role,
      avatar_url:
        (user.user_metadata?.avatar_url as string | undefined) ||
        (user.user_metadata?.picture as string | undefined) ||
        null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  const dashboard =
    next && next.startsWith("/")
      ? next
      : getDashboardPath(role);

  // Bridge: client page stores SessionUser for existing RequirePlatformAuth,
  // then routes to the dashboard.
  const complete = new URL("/auth/complete", origin);
  complete.searchParams.set("email", user.email);
  complete.searchParams.set("name", name);
  complete.searchParams.set("role", role);
  complete.searchParams.set("id", user.id);
  if (user.user_metadata?.avatar_url || user.user_metadata?.picture) {
    complete.searchParams.set(
      "avatarUrl",
      (user.user_metadata.avatar_url || user.user_metadata.picture) as string,
    );
  }
  complete.searchParams.set("next", dashboard);

  return NextResponse.redirect(complete.toString());
}
