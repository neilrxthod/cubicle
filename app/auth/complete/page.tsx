"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setSession } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";

/**
 * After Supabase OAuth + allowlist pass, write the app session
 * (localStorage bridge used by existing dashboard guards).
 */
function CompleteInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const email = params.get("email");
    const name = params.get("name");
    const role = params.get("role") as UserRole | null;
    const id = params.get("id");
    const avatarUrl = params.get("avatarUrl") ?? undefined;
    const next = params.get("next") || "/";

    if (!email || !name || !role || (role !== "teacher" && role !== "admin")) {
      router.replace("/login?error=session_bridge");
      return;
    }

    setSession({
      id: id ?? undefined,
      email,
      name,
      role,
      avatarUrl: avatarUrl || undefined,
    });

    router.replace(next);
  }, [params, router]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#f6f6f7]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
        <p className="text-sm text-neutral-500">Finishing sign-in…</p>
      </div>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-[#f6f6f7]">
          <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
        </div>
      }
    >
      <CompleteInner />
    </Suspense>
  );
}
