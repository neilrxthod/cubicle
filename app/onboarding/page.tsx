"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import {
  needsOnboarding,
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
  const mustSetup = needsOnboarding(user.role, user.id, user.email);

  useEffect(() => {
    if (!mustSetup) {
      router.replace(onboardingHomeForRole(user.role));
    }
  }, [mustSetup, user.role, router]);

  if (!mustSetup) {
    return (
      <div className="flex h-svh max-h-svh items-center justify-center overflow-hidden bg-[#ececef]">
        <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  return <OnboardingWizard user={user} />;
}
