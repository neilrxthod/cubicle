"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticate, getDemoAccounts } from "@/lib/auth/credentials";
import type { DemoAccount } from "@/lib/auth/types";
import {
  completeLocalDemoOnboarding,
  ensureLocalDemoSandbox,
  isLocalDemoPersona,
} from "@/lib/auth/local-demo";
import { getSession, setSession } from "@/lib/auth/session";
import {
  needsOnboarding,
  onboardingHomeForRole,
  prepareOnboardingAfterAuth,
} from "@/lib/onboarding/storage";
import { authContainerVariants, authItemVariants } from "@/lib/auth/motion";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/auth/school-domain";
import { isLocalDemoMode } from "@/lib/data/durability";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/types";
import { AuthLayout } from "./auth-layout";
import { LegalConsent } from "./legal-consent";
import {
  GoogleIcon,
  SocialAccountPicker,
  type AuthProvider,
} from "./auth-ui";

const roleAccent: Record<DemoAccount["role"], string> = {
  teacher: "bg-emerald-600",
  admin: "bg-violet-600",
};

const LOGIN_ERRORS: Record<string, string> = {
  not_allowed: `Not on the IT allowlist. Contact IT.`,
  invalid_domain: `Only @${SCHOOL_EMAIL_DOMAIN} accounts can sign in.`,
  auth_failed: "Sign-in failed. Try again.",
  missing_code: "Sign-in was cancelled.",
  no_email: "No email returned from Google.",
  allowlist_error: "Could not verify access.",
  session_bridge: "Could not start session.",
  access_denied: "Sign-in denied.",
};

function messageForError(code: string | null): string {
  if (!code) return "";
  return LOGIN_ERRORS[code] ?? "Sign-in failed.";
}

function isDemoLoginEnabled() {
  // Local sandbox always exposes Demo Admin / Demo Teacher.
  if (isLocalDemoMode() && getDemoAccounts().length > 0) return true;
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [loadingRole, setLoadingRole] = useState<DemoAccount["role"] | null>(
    null,
  );
  const [googleLoading, setGoogleLoading] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalInvalid, setLegalInvalid] = useState(false);
  const [error, setError] = useState("");

  const supabaseReady = isSupabaseConfigured();
  const demoEnabled = isDemoLoginEnabled();
  const urlError = messageForError(searchParams.get("error"));
  const displayError = error || urlError;
  const accountDeleted = searchParams.get("deleted") === "1";

  useEffect(() => {
    const existing = getSession();
    if (!existing) return;
    if (needsOnboarding(existing.role, existing.id, existing.email)) {
      router.replace("/onboarding");
    } else {
      router.replace(onboardingHomeForRole(existing.role));
    }
  }, [router]);

  function requireLegal(): boolean {
    if (acceptedLegal) {
      setLegalInvalid(false);
      return true;
    }
    setLegalInvalid(true);
    setGoogleLoading(false);
    setLoadingRole(null);
    return false;
  }

  async function signInWithGoogle() {
    setError("");
    if (!requireLegal()) return;
    setGoogleLoading(true);

    if (!supabaseReady) {
      setError("Google sign-in is not configured.");
      setGoogleLoading(false);
      return;
    }

    try {
      window.location.assign("/auth/google");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setGoogleLoading(false);
    }
  }

  async function signInWithAccount(account: DemoAccount) {
    setError("");
    if (!requireLegal()) return;
    setLoadingRole(account.role);
    await new Promise((r) => setTimeout(r, 400));
    const user = authenticate(account.email, account.password);
    if (!user) {
      setError("Sign-in failed.");
      setLoadingRole(null);
      return;
    }
    if (isLocalDemoMode()) {
      ensureLocalDemoSandbox();
    }
    const sessionUser: SessionUser = {
      id: user.id ?? account.email,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl ?? account.avatarUrl,
      title: user.title,
      department: user.department,
      employmentType: user.employmentType,
    };
    setSession(sessionUser);
    // Demo personas: skip the first-run wizard so Admin ↔ Teacher switches stay fast.
    if (isLocalDemoPersona(sessionUser)) {
      completeLocalDemoOnboarding(sessionUser);
      router.push(onboardingHomeForRole(sessionUser.role));
      return;
    }
    // Other local accounts: re-prompt teaching setup after auth.
    prepareOnboardingAfterAuth(user.id, user.email);
    router.push("/onboarding");
  }

  function handleGoogleClick() {
    setError("");
    if (!requireLegal()) return;
    if (supabaseReady) {
      void signInWithGoogle();
      return;
    }
    if (demoEnabled) {
      setProvider("google");
      return;
    }
    setError("Google sign-in is not configured.");
  }

  const demoAccounts = getDemoAccounts();
  const accountOptions = demoAccounts.map((account) => ({
    name: account.name,
    email: account.email,
    roleLabel: account.label,
    accent: roleAccent[account.role],
    avatarUrl: account.avatarUrl,
    isLoading: loadingRole === account.role,
    onSelect: () => signInWithAccount(account),
  }));

  return (
    <AuthLayout>
      <motion.div
        variants={authContainerVariants}
        initial={false}
        animate="visible"
        className="w-full"
      >
        <motion.div variants={authItemVariants} className="mb-8">
          <h1 className="type-page-title text-neutral-950">
            Sign in
          </h1>
          <p className="mt-2 text-[13.5px] text-neutral-500">
            @{SCHOOL_EMAIL_DOMAIN} · allowlist only
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {provider && demoEnabled ? (
            <motion.div
              key="picker"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <SocialAccountPicker
                provider={provider}
                accounts={accountOptions}
                onCancel={() => {
                  setProvider(null);
                  setError("");
                  setLoadingRole(null);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              {supabaseReady ? (
                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={googleLoading}
                  className={cn(
                    "flex h-11 w-full items-center justify-center gap-2.5 rounded-full",
                    "bg-neutral-950 text-[14px] font-medium tracking-[-0.01em] text-white",
                    "transition-[opacity,transform] duration-150",
                    "hover:opacity-90 active:scale-[0.99]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  {googleLoading ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                  ) : (
                    <span className="flex size-[18px] items-center justify-center rounded-full bg-white">
                      <GoogleIcon width={12} height={12} />
                    </span>
                  )}
                  {googleLoading ? "Connecting" : "Continue with Google"}
                </button>
              ) : null}

              {demoEnabled && demoAccounts.length > 0 ? (
                <div className="space-y-3">
                  {supabaseReady ? (
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-neutral-200" />
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                        Local sandbox
                      </span>
                      <span className="h-px flex-1 bg-neutral-200" />
                    </div>
                  ) : (
                    <p className="text-center text-[12.5px] text-neutral-500">
                      Local development sandbox
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {demoAccounts.map((account) => (
                      <button
                        key={account.email}
                        type="button"
                        disabled={loadingRole !== null}
                        onClick={() => void signInWithAccount(account)}
                        className={cn(
                          "flex h-11 flex-col items-center justify-center rounded-xl border border-black/[0.08] bg-white px-2",
                          "text-[13px] font-medium tracking-[-0.01em] text-neutral-950",
                          "transition-colors hover:bg-neutral-50",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/10",
                          "disabled:pointer-events-none disabled:opacity-50",
                        )}
                      >
                        {loadingRole === account.role ? (
                          <span className="size-4 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
                        ) : (
                          <>
                            <span>{account.role === "admin" ? "Admin" : "Teacher"}</span>
                            <span className="text-[10.5px] font-normal text-neutral-400">
                              {account.name.split(" ")[0]}
                            </span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : !supabaseReady ? (
                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={googleLoading}
                  className={cn(
                    "flex h-11 w-full items-center justify-center gap-2.5 rounded-full",
                    "bg-neutral-950 text-[14px] font-medium tracking-[-0.01em] text-white",
                    "transition-[opacity,transform] duration-150",
                    "hover:opacity-90 active:scale-[0.99]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  Continue with Google
                </button>
              ) : null}

              <LegalConsent
                checked={acceptedLegal}
                onCheckedChange={(value) => {
                  setAcceptedLegal(value);
                  if (value) setLegalInvalid(false);
                }}
                invalid={legalInvalid}
              />

              {accountDeleted && !displayError ? (
                <p
                  role="status"
                  className="text-center text-[12.5px] font-medium text-neutral-600"
                >
                  Your account was deleted.
                </p>
              ) : null}
              {displayError ? (
                <p
                  role="alert"
                  className="text-center text-[12.5px] font-medium text-red-600"
                >
                  {displayError}
                </p>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AuthLayout>
  );
}
