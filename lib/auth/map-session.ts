import type { SessionUser as AuthSessionUser } from "@/lib/auth/types";
import { getState } from "@/lib/data/platform-store";
import type { SessionUser } from "@/lib/types";

function pickAvatar(
  primary?: string | null,
  fallback?: string | null,
): string | undefined {
  const a = primary?.trim();
  const b = fallback?.trim();
  if (a) return a;
  if (b) return b;
  return undefined;
}

/** Map auth session → platform SessionUser (with stable id + profile fields). */
export function toPlatformSession(user: AuthSessionUser): SessionUser {
  const match = getState().users.find(
    (entry) => entry.email.toLowerCase() === user.email.toLowerCase(),
  );
  if (match) {
    return {
      // Prefer real Supabase user id from session when store has a pending: stub.
      id:
        user.id && !user.id.startsWith("pending:")
          ? user.id
          : match.id.startsWith("pending:")
            ? user.id ?? match.id
            : match.id,
      // Prefer session first so a just-saved Settings name hits the header
      // immediately; platform store (Realtime / refresh) is the fallback.
      name: (user.name?.trim() || match.name || user.name).trim(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: match.email,
      role: match.role,
      // Prefer session first so a just-saved photo hits the header immediately;
      // platform store (Realtime / refresh) fills in when session is empty.
      avatarUrl: pickAvatar(user.avatarUrl, match.avatarUrl),
      title: match.title ?? user.title,
      department: match.department ?? user.department,
      phone: match.phone ?? user.phone,
      bio: match.bio ?? user.bio,
      notifyEmail: match.notifyEmail ?? user.notifyEmail ?? true,
      notifyIssues: match.notifyIssues ?? user.notifyIssues ?? true,
      employmentType: match.employmentType,
    };
  }
  return {
    id: user.id ?? user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    avatarUrl: pickAvatar(user.avatarUrl),
    title: user.title,
    department: user.department,
    phone: user.phone,
    bio: user.bio,
    notifyEmail: user.notifyEmail ?? true,
    notifyIssues: user.notifyIssues ?? true,
  };
}
