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
import { AuthLayout } from "./auth-layout";
import { LegalConsent } from "./legal-consent";
import {
  SocialAccountPicker,
  SocialSignInButton,
  type AuthProvider,
} from "./auth-ui";

const roleAccent: Record<DemoAccount["role"], string> = {
  teacher: "bg-emerald-600",
  admin: "bg-violet-600",
};

const LOGIN_ERRORS: Record<string, string> = {
  not_allowed: `Your @${SCHOOL_EMAIL_DOMAIN} account is not on the IT allowlist. Contact IT.`,
  invalid_domain: `Only @${SCHOOL_EMAIL_DOMAIN} accounts can sign in.`,
  auth_failed: "Google sign-in failed. Please try again.",
  missing_code: "Sign-in was cancelled or incomplete.",
  no_email: "Google did not return an email for this account.",
  allowlist_error: "Could not verify school access. Try again.",
  session_bridge: "Could not start your session. Try again.",
  access_denied: "Google sign-in was denied.",
};

function messageForError(code: string | null): string {
  if (!code) return "";
  return LOGIN_ERRORS[code] ?? "Sign-in failed. Please try again.";
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
    if (existing) {
      router.replace(getDashboardPath(existing.role));
    }
  }, [router]);

  useEffect(() => {
    const code = searchParams.get("error");
    if (code) setError(messageForError(code));
  }, [searchParams]);

  async function signInWithGoogle() {
    setError("");
    if (!acceptedLegal) {
      setLegalInvalid(true);
      setError("Accept the terms to continue.");
      return;
    }
    setLegalInvalid(false);
    setGoogleLoading(true);

    if (!supabaseReady) {
      setError("Google sign-in is not configured. Check Vercel env vars.");
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
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }

  async function signInWithAccount(account: DemoAccount) {
    setError("");
    setLoadingRole(account.role);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const user = authenticate(account.email, account.password);
    if (!user) {
      setError("Sign-in failed.");
      setLoadingRole(null);
      return;
    }
    setSession(user);
    router.push(getDashboardPath(user.role));
  }

  function openProvider(next: AuthProvider) {
    setError("");
    if (next === "google") {
      if (!acceptedLegal) {
        setLegalInvalid(true);
        setError("Accept the terms to continue.");
        return;
      }
      setLegalInvalid(false);
      if (supabaseReady) {
        void signInWithGoogle();
        return;
      }
      if (demoEnabled) {
        setProvider(next);
        return;
      }
      setError("Google sign-in is not configured. Check Vercel env vars.");
      return;
    }
    if (demoEnabled) {
      setProvider(next);
      return;
    }
    setError("Only Google sign-in is available.");
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
        {/* Title block — tight hierarchy */}
        <motion.div variants={authItemVariants} className="mb-7">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.04em] text-neutral-950">
            Sign in
          </h1>
          <p className="mt-2 text-[14px] leading-snug text-neutral-500">
            School Google only ·{" "}
            <span className="font-medium text-neutral-800">
              @{SCHOOL_EMAIL_DOMAIN}
            </span>
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {provider && demoEnabled ? (
            <motion.div
              key="picker"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-5"
            >
              {/* 1. Primary action */}
              <SocialSignInButton
                provider="google"
                onClick={() => openProvider("google")}
                isLoading={googleLoading}
              />

              {/* 2. Legal acceptance */}
              <LegalConsent
                checked={acceptedLegal}
                onCheckedChange={(value) => {
                  setAcceptedLegal(value);
                  if (value) {
                    setLegalInvalid(false);
                    if (error === "Accept the terms to continue.") setError("");
                  }
                }}
                invalid={legalInvalid}
              />

              {/* 3. Access rule — one quiet line */}
              <p className="text-center text-[12px] leading-relaxed text-neutral-400">
                Allowlist required · Gmail and other domains blocked
              </p>

              {error ? (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-3 py-2.5 text-center text-[12.5px] leading-relaxed text-red-600"
                >
                  {error}
                </p>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AuthLayout>
  );
}
