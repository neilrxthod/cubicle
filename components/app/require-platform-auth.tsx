"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionSnapshot,
  subscribeToSession,
} from "@/lib/auth/session";
import { toPlatformSession } from "@/lib/auth/map-session";
import type { Role, SessionUser } from "@/lib/types";

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

  useEffect(() => {
    if (session === null) {
      router.replace("/login");
      return;
    }
    if (role && session.role !== role) {
      router.replace(session.role === "admin" ? "/admin" : "/");
    }
  }, [session, role, router]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  if (role && session.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  return <>{children(toPlatformSession(session))}</>;
}
