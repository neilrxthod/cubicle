import {
  getSession,
  setSession,
} from "@/lib/auth/session";
import { splitDisplayName } from "@/lib/profile/display-name";
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

  const nextName = profile.name?.trim() || session.name;
  const nameChanged = Boolean(profile.name) && profile.name !== session.name;
  const nextAvatar = profile.avatarUrl ?? undefined;
  const sessionAvatar = session.avatarUrl ?? undefined;
  const avatarChanged = nextAvatar !== sessionAvatar;
  const titleChanged = (profile.title ?? undefined) !== (session.title ?? undefined);
  const deptChanged =
    (profile.department ?? undefined) !== (session.department ?? undefined);

  if (!nameChanged && !avatarChanged && !titleChanged && !deptChanged) {
    return;
  }

  const nameBits = nameChanged ? splitDisplayName(nextName) : null;

  setSession({
    ...session,
    name: nextName,
    ...(nameBits
      ? { firstName: nameBits.firstName, lastName: nameBits.lastName }
      : null),
    // Always take the profiles row as source of truth (including clear → undefined).
    avatarUrl: nextAvatar,
    title: profile.title ?? session.title,
    department: profile.department ?? session.department,
    phone: profile.phone ?? session.phone,
    bio: profile.bio ?? session.bio,
    notifyEmail: profile.notifyEmail ?? session.notifyEmail,
    notifyIssues: profile.notifyIssues ?? session.notifyIssues,
    employmentType: profile.employmentType ?? session.employmentType,
  });
}
