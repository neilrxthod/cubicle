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

  // Prefer Google first+last whenever the provider sends a real name.
  // Also replace email-local / placeholder profile names.
  const nextName =
    googleName ||
    (!isPlaceholderDisplayName(existingName, profile.email)
      ? existingName
      : identity.fullName);

  const avatarFromGoogle = identity.avatarUrl;
  const nextAvatar =
    avatarFromGoogle ||
    (typeof profile.avatar_url === "string" ? profile.avatar_url : undefined);

  const nameChanged = nextName && nextName !== existingName;
  const avatarChanged =
    Boolean(avatarFromGoogle) && profile.avatar_url !== avatarFromGoogle;

  if (nameChanged || avatarChanged) {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (nameChanged) payload.name = nextName;
    if (avatarChanged) payload.avatar_url = avatarFromGoogle;

    await supabase.from("profiles").update(payload).eq("id", user.id);

    if (nameChanged && nextName) {
      // Denormalized columns → Realtime broadcasts to every open dashboard.
      await Promise.all([
        supabase
          .from("bookings")
          .update({ teacher_name: nextName })
          .eq("teacher_id", user.id),
        supabase
          .from("issues")
          .update({ reporter_name: nextName })
          .eq("reported_by_id", user.id),
        supabase
          .from("swap_requests")
          .update({ requester_name: nextName })
          .eq("requester_id", user.id),
      ]);
    }
  }

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
    firstName: identity.firstName,
    lastName: identity.lastName,
  };
}
