"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticate, DEMO_ACCOUNTS } from "@/lib/auth/credentials";
import type { DemoAccount } from "@/lib/auth/types";
import {
  getDashboardPath,
  getSession,
  setSession,
} from "@/lib/auth/session";
import { authContainerVariants, authItemVariants } from "@/lib/auth/motion";
import {
  GOOGLE_HOSTED_DOMAIN,
  SCHOOL_EMAIL_DOMAIN,
} from "@/lib/auth/school-domain";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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

const LEGAL_REQUIRED =
  "You must accept the Terms and policies before signing in.";

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

  useEffect(() => {
    const existing = getSession();
    if (existing) router.replace(getDashboardPath(existing.role));
  }, [router]);

  useEffect(() => {
    const code = searchParams.get("error");
    if (code) setError(messageForError(code));
  }, [searchParams]);

  function requireLegal(): boolean {
    if (acceptedLegal) {
      setLegalInvalid(false);
      return true;
    }
    setLegalInvalid(true);
    setError(LEGAL_REQUIRED);
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
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            hd: GOOGLE_HOSTED_DOMAIN,
            prompt: "select_account",
          },
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
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
    setSession(user);
    router.push(getDashboardPath(user.role));
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

  const accountOptions = DEMO_ACCOUNTS.map((account) => ({
    name: account.name,
    email: account.email,
    roleLabel: account.label,
    accent: roleAccent[account.role],
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
          <h1 className="text-[1.875rem] font-semibold tracking-[-0.045em] text-neutral-950">
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
                {googleLoading ? "Connecting…" : "Continue with Google"}
              </button>

              <LegalConsent
                checked={acceptedLegal}
                onCheckedChange={(value) => {
                  setAcceptedLegal(value);
                  if (value) {
                    setLegalInvalid(false);
                    if (error === LEGAL_REQUIRED) setError("");
                  }
                }}
                invalid={legalInvalid}
              />

              {(error || legalInvalid) && (
                <p
                  role="alert"
                  className="text-center text-[12.5px] font-medium text-red-600"
                >
                  {error || "You must accept to sign in."}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AuthLayout>
  );
}
