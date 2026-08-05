import type { User } from "@supabase/supabase-js";
import {
  extractOAuthIdentity,
  isPlaceholderDisplayName,
} from "@/lib/auth/google-identity";
import type { UserRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";

export type SyncedOAuthProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  title?: string;
  department?: string;
  phone?: string;
  bio?: string;
  notifyEmail: boolean;
  notifyIssues: boolean;
  firstName?: string;
  lastName?: string;
};

/**
 * Pull First + Last from the Google account on the Supabase user, write to
 * `profiles`, and fan-out denormalized display names so Realtime clients update.
 *
 * Safe to call on every OAuth complete / session restore.
 */
export async function syncOAuthProfileFromGoogle(
  user: User,
): Promise<SyncedOAuthProfile | null> {
  if (!user.email) return null;

  const identity = extractOAuthIdentity(user);
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, name, role, avatar_url, title, department, phone, bio, notify_email, notify_issues",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const role = profile.role as UserRole;
  if (role !== "teacher" && role !== "admin") return null;

  const googleName = identity.fromGoogle ? identity.fullName : undefined;
  const existingName =
    typeof profile.name === "string" ? profile.name.trim() : "";

  // Keep user-chosen Settings names. Only fill from Google when the profile
  // still has a placeholder / email-local name (or is empty).
  const existingIsPlaceholder =
    !existingName || isPlaceholderDisplayName(existingName, profile.email);
  const nextName = existingIsPlaceholder
    ? googleName || existingName || identity.fullName
    : existingName;

  // Never overwrite a user-chosen profile photo with Google on token refresh.
  // Only seed Google's picture when the profile has no avatar yet.
  const existingAvatar =
    typeof profile.avatar_url === "string" && profile.avatar_url.trim()
      ? profile.avatar_url.trim()
      : undefined;
  const avatarFromGoogle = identity.avatarUrl?.trim() || undefined;
  const nextAvatar = existingAvatar || avatarFromGoogle;

  const nameSeeded =
    Boolean(existingIsPlaceholder && nextName && nextName !== existingName);
  const avatarSeeded = Boolean(!existingAvatar && avatarFromGoogle);

  if (nameSeeded || avatarSeeded) {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (nameSeeded) payload.name = nextName;
    if (avatarSeeded) payload.avatar_url = avatarFromGoogle;

    await supabase.from("profiles").update(payload).eq("id", user.id);

    if (nameSeeded && nextName) {
      // Denormalized columns → Realtime broadcasts to every open dashboard.
      const { dbSyncBookingTeacherName } = await import(
        "@/lib/supabase/platform-api"
      );
      await dbSyncBookingTeacherName(user.id, nextName, {
        email: profile.email,
      });
    }
  }

  // Header chip uses firstName — keep it aligned with the profile display name
  // when the user customized it (not a fresh Google seed).
  const nameParts = nextName.trim().split(/\s+/).filter(Boolean);
  const firstName = existingIsPlaceholder
    ? identity.firstName || nameParts[0]
    : nameParts[0] || identity.firstName;
  const lastName = existingIsPlaceholder
    ? identity.lastName ||
      (nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined)
    : nameParts.length > 1
      ? nameParts.slice(1).join(" ")
      : undefined;

  return {
    id: profile.id,
    email: profile.email,
    name: nextName || existingName || identity.fullName,
    role,
    avatarUrl: nextAvatar,
    title: profile.title ?? undefined,
    department: profile.department ?? undefined,
    phone: profile.phone ?? undefined,
    bio: profile.bio ?? undefined,
    notifyEmail: profile.notify_email ?? true,
    notifyIssues: profile.notify_issues ?? true,
    firstName,
    lastName,
  };
}
