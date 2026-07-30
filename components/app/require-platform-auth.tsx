"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearSession,
  getSessionSnapshot,
  setSession,
  subscribeToSession,
} from "@/lib/auth/session";
import { isSchoolEmail } from "@/lib/auth/school-domain";
import { toPlatformSession } from "@/lib/auth/map-session";
import { PlatformBootstrap } from "@/components/app/platform-bootstrap";
import { isOnboardingComplete } from "@/lib/onboarding/storage";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Role, SessionUser } from "@/lib/types";
import type { UserRole } from "@/lib/auth/types";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
      <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
    </div>
  );
}

export function RequirePlatformAuth({
  role,
  children,
  /** Skip redirect to /onboarding (used by the onboarding page itself). */
  skipOnboarding = false,
}: {
  role?: Role;
  children: (user: SessionUser) => React.ReactNode;
  skipOnboarding?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => null,
  );
  const needsSessionRestore =
    isSupabaseConfigured() && !getSessionSnapshot();
  const [restoring, setRestoring] = useState(needsSessionRestore);

  // Restore app session from Supabase if localStorage was cleared but cookies remain.
  useEffect(() => {
    if (!needsSessionRestore) return;

    let cancelled = false;

    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user?.email || !isSchoolEmail(user.email)) {
          if (user && !isSchoolEmail(user.email ?? "")) {
            await supabase.auth.signOut();
          }
          setRestoring(false);
          return;
        }

        // Re-pull First + Last from Google metadata and fan-out to the board.
        const { syncOAuthProfileFromGoogle } = await import(
          "@/lib/auth/sync-oauth-profile"
        );
        const synced = await syncOAuthProfileFromGoogle(user);

        if (cancelled) return;

        if (!synced || !isSchoolEmail(synced.email)) {
          setRestoring(false);
          return;
        }

        setSession({
          id: synced.id,
          email: synced.email,
          name: synced.name,
          firstName: synced.firstName,
          lastName: synced.lastName,
          role: synced.role as UserRole,
          avatarUrl: synced.avatarUrl,
          title: synced.title,
          department: synced.department,
          phone: synced.phone,
          bio: synced.bio,
          notifyEmail: synced.notifyEmail,
          notifyIssues: synced.notifyIssues,
        });
      } catch {
        // fall through to login redirect
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsSessionRestore]);

  // Live: when Google token refreshes or user metadata changes, re-sync name.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, authSession) => {
        // Defer so we never call Supabase from inside the auth lock (SDK guidance).
        setTimeout(() => {
          void (async () => {
            if (cancelled) return;
            if (
              event !== "TOKEN_REFRESHED" &&
              event !== "USER_UPDATED" &&
              event !== "SIGNED_IN"
            ) {
              return;
            }
            const user = authSession?.user;
            if (!user?.email || !isSchoolEmail(user.email)) return;

            try {
              const { syncOAuthProfileFromGoogle } = await import(
                "@/lib/auth/sync-oauth-profile"
              );
              const synced = await syncOAuthProfileFromGoogle(user);
              if (cancelled || !synced) return;

              const current = getSessionSnapshot();
              if (!current || current.id !== synced.id) return;

              if (
                current.name !== synced.name ||
                current.avatarUrl !== synced.avatarUrl ||
                current.firstName !== synced.firstName ||
                current.lastName !== synced.lastName
              ) {
                setSession({
                  ...current,
                  name: synced.name,
                  firstName: synced.firstName,
                  lastName: synced.lastName,
                  avatarUrl: synced.avatarUrl,
                });
              }
            } catch {
              // ignore transient network errors
            }
          })();
        }, 0);
      });

      if (cancelled) {
        subscription.unsubscribe();
        return;
      }
      unsubscribe = () => subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // Enforce school domain on any client session (blocks stale demo sessions).
  useEffect(() => {
    if (restoring || !session) return;
    if (isSupabaseConfigured() && !isSchoolEmail(session.email)) {
      clearSession();
      router.replace("/login?error=invalid_domain");
    }
  }, [session, restoring, router]);

  useEffect(() => {
    if (restoring) return;
    if (session === null) {
      router.replace("/login");
      return;
    }
    if (role && session.role !== role) {
      router.replace(session.role === "admin" ? "/admin" : "/");
      return;
    }

    // First-run workspace setup for teachers and admins.
    if (!skipOnboarding) {
      const key = session.id || session.email;
      const done = isOnboardingComplete(key);
      if (!done && pathname !== "/onboarding") {
        router.replace("/onboarding");
      }
    }
  }, [session, role, router, restoring, skipOnboarding, pathname]);

  if (restoring || !session) {
    return <LoadingScreen />;
  }

  if (isSupabaseConfigured() && !isSchoolEmail(session.email)) {
    return <LoadingScreen />;
  }

  if (role && session.role !== role) {
    return <LoadingScreen />;
  }

  const onboardingKey = session.id || session.email;

  if (
    !skipOnboarding &&
    !isOnboardingComplete(onboardingKey) &&
    pathname !== "/onboarding"
  ) {
    return <LoadingScreen />;
  }

  return (
    <PlatformBootstrap>{children(toPlatformSession(session))}</PlatformBootstrap>
  );
}
