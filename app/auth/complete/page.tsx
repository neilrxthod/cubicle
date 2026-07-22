"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { extractOAuthAvatarUrl } from "@/lib/auth/google-avatar";
import { isSchoolEmail } from "@/lib/auth/school-domain";
import { setSession } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";

/**
 * After Supabase OAuth + allowlist pass, load profile (incl. Google photo)
 * and write the app session used by RequirePlatformAuth.
 */
function CompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userError || !user?.email) {
          router.replace("/login?error=session_bridge");
          return;
        }

        // Defense in depth: never complete sign-in for non-school domains
        if (!isSchoolEmail(user.email)) {
          await supabase.auth.signOut();
          router.replace("/login?error=invalid_domain");
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

        if (!profile) {
          router.replace("/login?error=session_bridge");
          return;
        }

        const role = profile.role as UserRole;
        if (role !== "teacher" && role !== "admin") {
          router.replace("/login?error=session_bridge");
          return;
        }

        const avatarFromGoogle = extractOAuthAvatarUrl(user);
        const avatarUrl =
          (typeof profile.avatar_url === "string" && profile.avatar_url) ||
          avatarFromGoogle ||
          undefined;

        // Backfill Google photo into profiles if the row was missing it.
        if (avatarFromGoogle && profile.avatar_url !== avatarFromGoogle) {
          await supabase
            .from("profiles")
            .update({
              avatar_url: avatarFromGoogle,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
        }

        setSession({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role,
          avatarUrl,
          title: profile.title ?? undefined,
          department: profile.department ?? undefined,
          phone: profile.phone ?? undefined,
          bio: profile.bio ?? undefined,
          notifyEmail: profile.notify_email ?? true,
          notifyIssues: profile.notify_issues ?? true,
        });

        const next = params.get("next") || (role === "admin" ? "/admin" : "/");
        router.replace(next.startsWith("/") ? next : "/");
      } catch {
        if (!cancelled) {
          setMessage("Could not finish sign-in.");
          router.replace("/login?error=session_bridge");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#f6f6f7]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
        <p className="text-sm text-neutral-500">{message}</p>
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
