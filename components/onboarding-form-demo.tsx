"use client";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import type { SessionUser } from "@/lib/types";

const previewUser: SessionUser = {
  id: "preview-teacher",
  name: "Neil Rathod",
  firstName: "Neil",
  lastName: "Rathod",
  email: "neil.rathod@rbe.sk.ca",
  role: "teacher",
  avatarUrl:
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80&auto=format&fit=crop",
};

/**
 * Same card used after real sign-in (`/onboarding`).
 * Preview: /dev/animated-registration-form
 */
export default function OnboardingFormDemo() {
  return <OnboardingWizard user={previewUser} />;
}
