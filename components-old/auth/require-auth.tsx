"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser, UserRole } from "@/lib/auth/types";
import {
  clearSession,
  getDashboardPath,
  getSessionSnapshot,
  subscribeToSession,
} from "@/lib/auth/session";

type RequireAuthProps = {
  role: UserRole;
  children: (user: SessionUser) => React.ReactNode;
};

export function RequireAuth({ role, children }: RequireAuthProps) {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => null,
  );

  const isAuthorized = session !== null && session.role === role;

  useEffect(() => {
    if (session === null) {
      router.replace("/login");
      return;
    }

    if (session.role !== role) {
      router.replace(getDashboardPath(session.role));
    }
  }, [session, role, router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  return <>{children(session)}</>;
}

export function useLogout() {
  const router = useRouter();

  return () => {
    clearSession();
    router.replace("/login");
  };
}
