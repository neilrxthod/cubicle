import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  checkSchoolAccess,
  deleteUnauthorizedUser,
} from "@/lib/auth/allowlist";
import {
  extractOAuthIdentity,
  isPlaceholderDisplayName,
} from "@/lib/auth/google-identity";
import { isSafeInternalPath } from "@/lib/auth/safe-path";
import { getDashboardPath } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * After a session exists (PKCE exchange or Google id_token), enforce
 * domain + allowlist and send the user to /auth/complete.
 *
 * Profile writes use the service role: `profiles` has no INSERT policy for
 * the user JWT, and Postgres still requires one for `ON CONFLICT` upserts.
 */
export async function finalizeSchoolLogin(
  origin: string,
  next: string | null,
  knownUser?: User | null,
): Promise<NextResponse> {
  // The callback already has the exchanged user. Avoid rebuilding the
  // cookie-backed client on the successful path; create it only when an
  // invalid account needs to be signed out.
  let supabase: Awaited<ReturnType<typeof createClient>> | undefined;
  let user = knownUser;
  if (!user) {
    supabase = await createClient();
    user = (await supabase.auth.getUser()).data.user;
  }

  if (!user?.email) {
    supabase ??= await createClient();
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("no_email")}`,
    );
  }

  const admin = createAdminClient();
  const [access, existingRes] = await Promise.all([
    checkSchoolAccess(user.email),
    admin
      .from("profiles")
      .select("avatar_url, name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!access.ok) {
    const userId = user.id;
    supabase ??= await createClient();
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

  const existing = existingRes.data;
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

  let { error: upsertError } = await admin.from("profiles").upsert(
    {
      ...profilePayload,
      employment_type: employmentType,
    },
    { onConflict: "id" },
  );

  if (upsertError?.message?.toLowerCase().includes("employment_type")) {
    ({ error: upsertError } = await admin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" }));
  }

  if (upsertError) {
    console.error("[auth] profile upsert failed:", upsertError.message);
  }

  const dashboard = isSafeInternalPath(next) ? next : getDashboardPath(role);

  const complete = new URL("/auth/complete", origin);
  complete.searchParams.set("next", dashboard);
  return NextResponse.redirect(complete.toString());
}
