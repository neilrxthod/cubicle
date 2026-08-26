"use client";

import { Suspense, useEffect } from "react";
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
import {
  BloubLoading,
  GOOGLE_AUTH_LOADING_MS,
  markPostAuthSplash,
  waitAtLeast,
} from "@/components/app/bloub-loading";

/**
 * After Supabase OAuth + allowlist pass:
 * 1. Pull First + Last name (and photo) from the Google account
 * 2. Persist to profiles + denormalized booking/issue names
 * 3. Write the app session used by RequirePlatformAuth
 */
function CompleteInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const startedAt = Date.now();
      markPostAuthSplash(startedAt);
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userError || !user?.email) {
          try {
            const { clearBrowserAuthCookies } = await import(
              "@/lib/supabase/clear-browser-auth"
            );
            await supabase.auth.signOut({ scope: "local" });
            clearBrowserAuthCookies();
          } catch {
            // ignore
          }
          router.replace("/login?error=session_bridge");
          return;
        }

        if (!isSchoolEmail(user.email)) {
          try {
            const { clearBrowserAuthCookies } = await import(
              "@/lib/supabase/clear-browser-auth"
            );
            await supabase.auth.signOut({ scope: "local" });
            clearBrowserAuthCookies();
          } catch {
            // ignore
          }
          router.replace("/login?error=invalid_domain");
          return;
        }

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
        await waitAtLeast(startedAt, GOOGLE_AUTH_LOADING_MS);
        if (cancelled) return;
        if (needsOnboarding(synced.role, synced.id, synced.email)) {
          router.replace("/onboarding");
        } else {
          router.replace(onboardingHomeForRole(synced.role));
        }
      } catch {
        if (!cancelled) {
          router.replace("/login?error=session_bridge");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return <BloubLoading label="Syncing your Google profile" />;
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={<BloubLoading label="Finishing sign-in" />}
    >
      <CompleteInner />
    </Suspense>
  );
}
