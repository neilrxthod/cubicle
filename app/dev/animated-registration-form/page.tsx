import type { Metadata } from "next";
import OnboardingFormDemo from "@/components/onboarding-form-demo";

export const metadata: Metadata = {
  title: "Onboarding card preview",
  robots: { index: false, follow: false },
};

/**
 * Live preview of the Morphin-style post-sign-in card.
 * Open: http://localhost:3000/dev/animated-registration-form
 */
export default function AnimatedRegistrationFormPreviewPage() {
  return <OnboardingFormDemo />;
}
