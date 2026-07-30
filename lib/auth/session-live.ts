import {
  getSession,
  setSession,
} from "@/lib/auth/session";
import type { PlatformState } from "@/lib/types";

/**
 * After a Realtime platform hydrate, keep the signed-in session's display
 * name / photo aligned with the live `profiles` row so header + settings
 * update without a full reload.
 */
export function syncSessionFromPlatformState(state: PlatformState) {
  const session = getSession();
  if (!session?.id) return;

  const profile = state.users.find((u) => u.id === session.id);
  if (!profile) return;

  const nameChanged = profile.name && profile.name !== session.name;
  const avatarChanged =
    (profile.avatarUrl ?? undefined) !== (session.avatarUrl ?? undefined);
  const titleChanged = (profile.title ?? undefined) !== (session.title ?? undefined);
  const deptChanged =
    (profile.department ?? undefined) !== (session.department ?? undefined);

  if (!nameChanged && !avatarChanged && !titleChanged && !deptChanged) {
    return;
  }

  setSession({
    ...session,
    name: profile.name || session.name,
    avatarUrl: profile.avatarUrl ?? session.avatarUrl,
    title: profile.title ?? session.title,
    department: profile.department ?? session.department,
    phone: profile.phone ?? session.phone,
    bio: profile.bio ?? session.bio,
    notifyEmail: profile.notifyEmail ?? session.notifyEmail,
    notifyIssues: profile.notifyIssues ?? session.notifyIssues,
    employmentType: profile.employmentType ?? session.employmentType,
  });
}
