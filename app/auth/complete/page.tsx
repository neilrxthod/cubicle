"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isSchoolEmail } from "@/lib/auth/school-domain";
import { setSession } from "@/lib/auth/session";
import { syncOAuthProfileFromGoogle } from "@/lib/auth/sync-oauth-profile";
import {
  needsOnboarding,
  onboardingHomeForRole,
  prepareOnboardingAfterAuth,
} from "@/lib/onboarding/storage";
import { createClient } from "@/lib/supabase/client";

/**
 * After Supabase OAuth + allowlist pass:
 * 1. Pull First + Last name (and photo) from the Google account
 * 2. Persist to profiles + denormalized booking/issue names
 * 3. Write the app session used by RequirePlatformAuth
 */
function CompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Syncing your Google profile…");

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

        if (!isSchoolEmail(user.email)) {
          await supabase.auth.signOut();
          router.replace("/login?error=invalid_domain");
          return;
        }

        setMessage("Loading your name from Google…");
        const synced = await syncOAuthProfileFromGoogle(user);

        if (cancelled) return;

        if (!synced) {
          router.replace("/login?error=session_bridge");
          return;
        }

        setSession({
          id: synced.id,
          email: synced.email,
          name: synced.name,
          role: synced.role,
          avatarUrl: synced.avatarUrl,
          title: synced.title,
          department: synced.department,
          phone: synced.phone,
          bio: synced.bio,
          notifyEmail: synced.notifyEmail,
          notifyIssues: synced.notifyIssues,
          firstName: synced.firstName,
          lastName: synced.lastName,
        });

        // Local dev: reset so onboarding shows after every sign-in.
        // Production: leave completed prefs so first-run stays one-time.
        prepareOnboardingAfterAuth(synced.id, synced.email);
        if (needsOnboarding(synced.role, synced.id, synced.email)) {
          router.replace("/onboarding");
        } else {
          router.replace(onboardingHomeForRole(synced.role));
        }
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
