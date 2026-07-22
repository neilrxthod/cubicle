import { NextResponse } from "next/server";
import {
  checkSchoolAccess,
  deleteUnauthorizedUser,
} from "@/lib/auth/allowlist";
import { extractOAuthAvatarUrl } from "@/lib/auth/google-avatar";
import { getDashboardPath } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Google OAuth callback.
 * Access rules (both required):
 * 1. Email domain must be @rbe.sk.ca (blocks gmail.com and all others)
 * 2. Email must be on allowed_emails
 * Unauthorized users are signed out and deleted from Auth.
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

  const access = await checkSchoolAccess(user.email);

  if (!access.ok) {
    const userId = user.id;
    await supabase.auth.signOut();
    await deleteUnauthorizedUser(userId);

    const errorCode =
      access.reason === "invalid_domain"
        ? "invalid_domain"
        : access.reason === "allowlist_error"
          ? "allowlist_error"
          : "not_allowed";

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorCode)}`,
    );
  }

  const allowed = access.allowed;
  const role = allowed.role as UserRole;
  const name =
    allowed.name ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email.split("@")[0];

  const employmentType = allowed.employmentType ?? "permanent";

  const avatarUrl = extractOAuthAvatarUrl(user);

  const { data: existing } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const nextAvatar =
    avatarUrl ||
    (typeof existing?.avatar_url === "string" ? existing.avatar_url : null);

  // Upsert core profile. employment_type requires employment-type.sql applied.
  const profilePayload: Record<string, unknown> = {
    id: user.id,
    email: user.email.toLowerCase(),
    name,
    role,
    avatar_url: nextAvatar,
    updated_at: new Date().toISOString(),
  };

  let { error: upsertError } = await supabase.from("profiles").upsert(
    {
      ...profilePayload,
      employment_type: employmentType,
    },
    { onConflict: "id" },
  );

  // Backward-compatible if employment_type column not migrated yet.
  if (upsertError?.message?.toLowerCase().includes("employment_type")) {
    ({ error: upsertError } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" }));
  }

  if (upsertError) {
    console.error("[auth/callback] profile upsert failed:", upsertError.message);
  }

  const dashboard =
    next && next.startsWith("/") ? next : getDashboardPath(role);

  const complete = new URL("/auth/complete", origin);
  complete.searchParams.set("next", dashboard);

  return NextResponse.redirect(complete.toString());
}
