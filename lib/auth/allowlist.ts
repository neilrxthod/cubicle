import type { UserRole } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type AllowedEmailRow = {
  email: string;
  role: UserRole;
  name: string | null;
};

/**
 * Look up a Google email on the school allowlist (service role).
 * Returns null if the email is not approved.
 */
export async function getAllowedEmail(
  email: string,
): Promise<AllowedEmailRow | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("allowed_emails")
    .select("email, role, name")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    console.error("[allowlist] lookup failed:", error.message);
    throw new Error("Could not verify school allowlist.");
  }

  if (!data) return null;

  return {
    email: data.email,
    role: data.role as UserRole,
    name: data.name,
  };
}

/**
 * Remove an auth user that signed in with a non-allowlisted Google account.
 */
export async function deleteUnauthorizedUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[allowlist] delete unauthorized user failed:", error.message);
  }
}
