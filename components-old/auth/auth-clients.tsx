"use client";

import dynamic from "next/dynamic";
import { AuthLoadingSkeleton } from "@/components/auth/auth-loading";

function createAuthClient(
  loader: () => Promise<{ default: React.ComponentType }>,
) {
  return dynamic(loader, {
    ssr: false,
    loading: () => <AuthLoadingSkeleton />,
  });
}

export const LoginClient = createAuthClient(() =>
  import("@/components/auth/login-form").then((module) => ({
    default: module.default,
  })),
);

export const SignupClient = createAuthClient(() =>
  import("@/components/auth/signup-form").then((module) => ({
    default: module.SignupForm,
  })),
);

export const ForgotPasswordClient = createAuthClient(() =>
  import("@/components/auth/forgot-password-form").then((module) => ({
    default: module.ForgotPasswordForm,
  })),
);

export const ResetPasswordClient = createAuthClient(() =>
  import("@/components/auth/reset-password-form").then((module) => ({
    default: module.ResetPasswordForm,
  })),
);

export const VerifyEmailClient = createAuthClient(() =>
  import("@/components/auth/verify-email-view").then((module) => ({
    default: module.VerifyEmailView,
  })),
);
