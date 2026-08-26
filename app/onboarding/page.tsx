"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BloubLoading } from "@/components/app/bloub-loading";
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
    return <BloubLoading className="max-h-svh overflow-hidden bg-[#ececef]" />;
  }

  return <OnboardingWizard user={user} />;
}
