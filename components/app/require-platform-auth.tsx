"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  clearSession,
  getSessionSnapshot,
  setSession,
  subscribeToSession,
} from "@/lib/auth/session";
import { isSchoolEmail } from "@/lib/auth/school-domain";
import { toPlatformSession } from "@/lib/auth/map-session";
import { PlatformBootstrap } from "@/components/app/platform-bootstrap";
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
}: {
  role?: Role;
  children: (user: SessionUser) => React.ReactNode;
}) {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => null,
  );
  const [restoring, setRestoring] = useState(
    () => isSupabaseConfigured() && !getSessionSnapshot(),
  );

  // Restore app session from Supabase if localStorage was cleared but cookies remain.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setRestoring(false);
      return;
    }
    if (getSessionSnapshot()) {
      setRestoring(false);
      return;
    }

    let cancelled = false;

    (async () => {
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

        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "id, email, name, role, avatar_url, title, department, phone, bio, notify_email, notify_issues",
          )
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (!profile || !isSchoolEmail(profile.email)) {
          setRestoring(false);
          return;
        }

        const { extractOAuthAvatarUrl } = await import(
          "@/lib/auth/google-avatar"
        );
        const avatarUrl =
          (typeof profile.avatar_url === "string" && profile.avatar_url) ||
          extractOAuthAvatarUrl(user) ||
          undefined;

        setSession({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role as UserRole,
          avatarUrl,
          title: profile.title ?? undefined,
          department: profile.department ?? undefined,
          phone: profile.phone ?? undefined,
          bio: profile.bio ?? undefined,
          notifyEmail: profile.notify_email ?? true,
          notifyIssues: profile.notify_issues ?? true,
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
    }
  }, [session, role, router, restoring]);

  if (restoring || !session) {
    return <LoadingScreen />;
  }

  if (isSupabaseConfigured() && !isSchoolEmail(session.email)) {
    return <LoadingScreen />;
  }

  if (role && session.role !== role) {
    return <LoadingScreen />;
  }

  return (
    <PlatformBootstrap>{children(toPlatformSession(session))}</PlatformBootstrap>
  );
}
