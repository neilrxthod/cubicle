"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import {
  isOnboardingComplete,
  onboardingHomeForRole,
} from "@/lib/onboarding/storage";
import type { SessionUser } from "@/lib/types";

export default function OnboardingPage() {
  return (
    <RequirePlatformAuth skipOnboarding>
      {(user) => <OnboardingGate user={user} />}
    </RequirePlatformAuth>
  );
}

function OnboardingGate({ user }: { user: SessionUser }) {
  const router = useRouter();

  const key = user.id || user.email;

  useEffect(() => {
    if (isOnboardingComplete(key)) {
      router.replace(onboardingHomeForRole(user.role));
    }
  }, [key, user.role, router]);

  if (isOnboardingComplete(key)) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#fafafa]">
        <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  return <OnboardingWizard user={user} />;
}
