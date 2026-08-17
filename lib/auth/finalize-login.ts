import { NextResponse } from "next/server";
import {
  checkSchoolAccess,
  deleteUnauthorizedUser,
} from "@/lib/auth/allowlist";
import {
  extractOAuthIdentity,
  isPlaceholderDisplayName,
} from "@/lib/auth/google-identity";
import { getDashboardPath } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

/**
 * After a session exists (PKCE exchange or Google id_token), enforce
 * domain + allowlist and send the user to /auth/complete.
 */
export async function finalizeSchoolLogin(
  origin: string,
  next: string | null,
): Promise<NextResponse> {
  const supabase = await createClient();
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
  const employmentType = allowed.employmentType ?? "permanent";

  const identity = extractOAuthIdentity(user);
  const googleOrAllowed =
    (identity.fromGoogle && identity.fullName) ||
    allowed.name?.trim() ||
    identity.fullName;

  const { data: existing } = await supabase
    .from("profiles")
    .select("avatar_url, name")
    .eq("id", user.id)
    .maybeSingle();

  const existingName =
    typeof existing?.name === "string" ? existing.name.trim() : "";
  const keepExistingName =
    Boolean(existingName) &&
    !isPlaceholderDisplayName(existingName, user.email);
  const name = keepExistingName ? existingName : googleOrAllowed;

  const existingAvatar =
    typeof existing?.avatar_url === "string" && existing.avatar_url.trim()
      ? existing.avatar_url.trim()
      : null;
  const nextAvatar = existingAvatar || identity.avatarUrl || null;

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

  if (upsertError?.message?.toLowerCase().includes("employment_type")) {
    ({ error: upsertError } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" }));
  }

  if (upsertError) {
    console.error("[auth] profile upsert failed:", upsertError.message);
  } else {
    await Promise.all([
      supabase
        .from("bookings")
        .update({ teacher_name: name })
        .eq("teacher_id", user.id),
      supabase
        .from("bookings")
        .update({ last_edited_by_name: name })
        .eq("last_edited_by_id", user.id),
      supabase
        .from("issues")
        .update({ reporter_name: name })
        .eq("reported_by_id", user.id),
      supabase
        .from("swap_requests")
        .update({ requester_name: name })
        .eq("requester_id", user.id),
      supabase
        .from("allowed_emails")
        .update({ name })
        .eq("email", user.email.toLowerCase()),
    ]);
  }

  const dashboard =
    next && next.startsWith("/") ? next : getDashboardPath(role);

  const complete = new URL("/auth/complete", origin);
  complete.searchParams.set("next", dashboard);
  return NextResponse.redirect(complete.toString());
}
