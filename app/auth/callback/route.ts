import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteUnauthorizedUser,
  getAllowedEmail,
} from "@/lib/auth/allowlist";
import { extractOAuthAvatarUrl } from "@/lib/auth/google-avatar";
import { getDashboardPath } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";

/**
 * Google OAuth returns here with ?code=...
 * 1. Exchange code for a Supabase session
 * 2. Allowlist check — reject if email is not pre-approved
 * 3. Sync profile (role, name, Google photo)
 * 4. Hand off to /auth/complete (loads session client-side — no avatar in query string)
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

  const avatarUrl = extractOAuthAvatarUrl(user);

  // Prefer Google photo when present; never wipe an existing custom photo with null.
  const { data: existing } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const nextAvatar =
    avatarUrl ||
    (typeof existing?.avatar_url === "string" ? existing.avatar_url : null);

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      name,
      role,
      avatar_url: nextAvatar,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  const dashboard =
    next && next.startsWith("/") ? next : getDashboardPath(role);

  const complete = new URL("/auth/complete", origin);
  complete.searchParams.set("next", dashboard);

  return NextResponse.redirect(complete.toString());
}
