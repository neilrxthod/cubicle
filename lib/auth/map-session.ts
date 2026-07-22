import type { SessionUser as AuthSessionUser } from "@/lib/auth/types";
import { getState } from "@/lib/data/platform-store";
import type { SessionUser } from "@/lib/types";

/** Map auth session → platform SessionUser (with stable id + profile fields). */
export function toPlatformSession(user: AuthSessionUser): SessionUser {
  const match = getState().users.find(
    (entry) => entry.email.toLowerCase() === user.email.toLowerCase(),
  );
  if (match) {
    return {
      id: match.id,
      name: match.name,
      email: match.email,
      role: match.role,
      avatarUrl: match.avatarUrl ?? user.avatarUrl,
      title: match.title ?? user.title,
      department: match.department ?? user.department,
      phone: match.phone ?? user.phone,
      bio: match.bio ?? user.bio,
      notifyEmail: match.notifyEmail ?? user.notifyEmail ?? true,
      notifyIssues: match.notifyIssues ?? user.notifyIssues ?? true,
    };
  }
  return {
    id: user.id ?? user.email,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    title: user.title,
    department: user.department,
    phone: user.phone,
    bio: user.bio,
    notifyEmail: user.notifyEmail ?? true,
    notifyIssues: user.notifyIssues ?? true,
  };
}
