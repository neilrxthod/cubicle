import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/auth-clients";
import { AuthLoadingSkeleton } from "@/components/auth/auth-loading";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthLoadingSkeleton />}>
      <VerifyEmailClient />
    </Suspense>
  );
}
