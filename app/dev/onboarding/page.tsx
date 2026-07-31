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
};

/**
 * Local preview of multi-step onboarding (no auth gate).
 * Open: http://localhost:3000/dev/onboarding
 */
export default function OnboardingPreviewPage() {
  return <OnboardingWizard user={previewUser} />;
}
