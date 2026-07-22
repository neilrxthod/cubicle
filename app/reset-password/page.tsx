import { Suspense } from "react";
import { ResetPasswordClient } from "@/components/auth/auth-clients";
import { AuthLoadingSkeleton } from "@/components/auth/auth-loading";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthLoadingSkeleton />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
