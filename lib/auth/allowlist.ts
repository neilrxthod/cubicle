import type { EmploymentType, UserRole } from "@/lib/auth/types";
import {
  isSchoolEmail,
  normalizeEmail,
  schoolEmailError,
} from "@/lib/auth/school-domain";
import { createAdminClient } from "@/lib/supabase/admin";

export type AllowedEmailRow = {
  email: string;
  role: UserRole;
  name: string | null;
  /** permanent = blue tick; defaults permanent if column missing */
  employmentType: EmploymentType;
};

export type AccessCheckResult =
  | { ok: true; allowed: AllowedEmailRow }
  | { ok: false; reason: "invalid_domain" | "not_allowlisted" | "allowlist_error" };

/**
 * Full access gate:
 * 1) Must be @rbe.sk.ca
 * 2) Must be on allowed_emails
 */
export async function checkSchoolAccess(
  email: string,
): Promise<AccessCheckResult> {
  const normalized = normalizeEmail(email);
  if (!normalized || !isSchoolEmail(normalized)) {
    return { ok: false, reason: "invalid_domain" };
  }

  try {
    const allowed = await getAllowedEmail(normalized);
    if (!allowed) {
      return { ok: false, reason: "not_allowlisted" };
    }
    return { ok: true, allowed };
  } catch {
    return { ok: false, reason: "allowlist_error" };
  }
}

function parseEmploymentType(value: unknown): EmploymentType {
  if (value === "substitute" || value === "temporary" || value === "permanent") {
    return value;
  }
  return "permanent";
}

/**
 * Look up a Google email on the school allowlist (service role).
 * Returns null if the email is not approved.
 * Also returns null for non-@rbe.sk.ca addresses.
 */
export async function getAllowedEmail(
  email: string,
): Promise<AllowedEmailRow | null> {
  const normalized = normalizeEmail(email);
  if (!normalized || !isSchoolEmail(normalized)) return null;

  const admin = createAdminClient();

  // Prefer full select including employment_type (after employment-type.sql).
  let data: {
    email: string;
    role: string;
    name: string | null;
    employment_type?: string | null;
  } | null = null;

  const withEmployment = await admin
    .from("allowed_emails")
    .select("email, role, name, employment_type")
    .eq("email", normalized)
    .maybeSingle();

  if (withEmployment.error) {
    const msg = withEmployment.error.message.toLowerCase();
    if (msg.includes("employment_type")) {
      const legacy = await admin
        .from("allowed_emails")
        .select("email, role, name")
        .eq("email", normalized)
        .maybeSingle();
      if (legacy.error) {
        console.error("[allowlist] lookup failed:", legacy.error.message);
        throw new Error("Could not verify school allowlist.");
      }
      data = legacy.data;
    } else {
      console.error("[allowlist] lookup failed:", withEmployment.error.message);
      throw new Error("Could not verify school allowlist.");
    }
  } else {
    data = withEmployment.data;
  }

  if (!data) return null;

  // Defense in depth if a bad row was inserted manually
  if (!isSchoolEmail(data.email)) return null;

  return {
    email: data.email,
    role: data.role as UserRole,
    name: data.name,
    employmentType: parseEmploymentType(data.employment_type),
  };
}

/**
 * Remove an auth user that signed in without access.
 */
export async function deleteUnauthorizedUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error(
      "[allowlist] delete unauthorized user failed:",
      error.message,
    );
  }
}

export { schoolEmailError, isSchoolEmail, normalizeEmail };
