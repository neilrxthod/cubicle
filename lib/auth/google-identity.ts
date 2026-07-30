import type { User } from "@supabase/supabase-js";
import { extractOAuthAvatarUrl } from "@/lib/auth/google-avatar";

export type OAuthDisplayName = {
  /** Given / first name from Google when available. */
  firstName?: string;
  /** Family / last name from Google when available. */
  lastName?: string;
  /** "First Last" (or best available single string). */
  fullName: string;
  /** True when we got a real personal name (not an email local-part). */
  fromGoogle: boolean;
};

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickFromRecord(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = asNonEmptyString(record[key]);
    if (value) return value;
  }
  return undefined;
}

/**
 * Collect identity_data bags from Google (and other) identities plus user_metadata.
 * Google Workspace typically provides given_name + family_name + name / full_name.
 */
function identityBags(user: User): Record<string, unknown>[] {
  const bags: Record<string, unknown>[] = [];

  if (user.user_metadata && typeof user.user_metadata === "object") {
    bags.push(user.user_metadata as Record<string, unknown>);
  }

  for (const identity of user.identities ?? []) {
    if (identity.identity_data && typeof identity.identity_data === "object") {
      bags.push(identity.identity_data as Record<string, unknown>);
    }
  }

  return bags;
}

/**
 * Extract first + last name from a Google (or generic OAuth) Supabase user.
 * Prefer structured given/family names; fall back to full_name / name.
 */
export function extractOAuthDisplayName(
  user: User | null | undefined,
  fallbackEmail?: string | null,
): OAuthDisplayName {
  const email = user?.email ?? fallbackEmail ?? "";
  const emailLocal = email.includes("@")
    ? email.split("@")[0]!.replace(/[._+]/g, " ").trim()
    : email.trim();

  if (!user) {
    return {
      fullName: emailLocal || "User",
      fromGoogle: false,
    };
  }

  const bags = identityBags(user);

  let firstName: string | undefined;
  let lastName: string | undefined;
  let fullFromProvider: string | undefined;

  for (const bag of bags) {
    firstName ||= pickFromRecord(bag, [
      "given_name",
      "givenName",
      "first_name",
      "firstName",
    ]);
    lastName ||= pickFromRecord(bag, [
      "family_name",
      "familyName",
      "last_name",
      "lastName",
      "surname",
    ]);
    fullFromProvider ||= pickFromRecord(bag, [
      "full_name",
      "fullName",
      "name",
      "display_name",
      "displayName",
    ]);
  }

  // If full name is "First Last" and parts missing, split once.
  if (fullFromProvider && (!firstName || !lastName)) {
    const parts = fullFromProvider.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      firstName ||= parts[0];
      lastName ||= parts.slice(1).join(" ");
    } else if (parts.length === 1) {
      firstName ||= parts[0];
    }
  }

  const composed =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    fullFromProvider ||
    undefined;

  if (composed) {
    return {
      firstName,
      lastName,
      fullName: composed.slice(0, 80),
      fromGoogle: true,
    };
  }

  return {
    fullName: (emailLocal || "User").slice(0, 80),
    fromGoogle: false,
  };
}

/**
 * Full OAuth identity snapshot used at sign-in / session bridge.
 */
export function extractOAuthIdentity(user: User | null | undefined) {
  const name = extractOAuthDisplayName(user);
  return {
    ...name,
    avatarUrl: extractOAuthAvatarUrl(user),
    email: user?.email?.toLowerCase() ?? undefined,
  };
}

/** True when stored profile name looks like a placeholder, not a person. */
export function isPlaceholderDisplayName(
  name: string | null | undefined,
  email?: string | null,
): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return true;
  if (n.includes("@")) return true;
  const local = (email ?? "").split("@")[0]?.toLowerCase() ?? "";
  if (local && n === local) return true;
  if (n === "user" || n === "teacher" || n === "admin") return true;
  return false;
}
