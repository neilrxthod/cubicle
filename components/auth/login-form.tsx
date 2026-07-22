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
import Link from "next/link";
import { AuthLayout } from "./auth-layout";
import {
  AuthPageHeader,
  SocialAccountPicker,
  SocialSignInButton,
  type AuthProvider,
} from "./auth-ui";

const roleAccent: Record<DemoAccount["role"], string> = {
  teacher: "bg-emerald-600",
  admin: "bg-violet-600",
};

const LOGIN_ERRORS: Record<string, string> = {
  not_allowed: `Your @${SCHOOL_EMAIL_DOMAIN} account is not on the school allowlist. Contact IT to be added.`,
  invalid_domain: `Only @${SCHOOL_EMAIL_DOMAIN} Google accounts can sign in. Gmail and other domains are blocked.`,
  auth_failed: "Google sign-in failed. Please try again.",
  missing_code: "Sign-in was cancelled or incomplete. Please try again.",
  no_email: "Google did not return an email address for this account.",
  allowlist_error: "Could not verify school access. Try again or contact IT.",
  session_bridge: "Signed in, but we could not start your session. Try again.",
  access_denied: "Google sign-in was denied.",
};

function messageForError(code: string | null): string {
  if (!code) return "";
  return LOGIN_ERRORS[code] ?? "Sign-in failed. Please try again.";
}

/** Demo teacher/admin picker only when explicitly enabled (local). Never on production. */
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
    if (code) {
      setError(messageForError(code));
    }
  }, [searchParams]);

  async function signInWithGoogle() {
    setError("");
    setGoogleLoading(true);

    if (!supabaseReady) {
      setError(
        "Google sign-in is not configured on this server. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Environment Variables, then redeploy.",
      );
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
            // Prefer school Workspace accounts in the Google account picker
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

    await new Promise((resolve) => setTimeout(resolve, 550));

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
      if (supabaseReady) {
        void signInWithGoogle();
        return;
      }
      if (demoEnabled) {
        setProvider(next);
        return;
      }
      setError(
        "Google sign-in is not configured. Add Supabase keys in Vercel Environment Variables and redeploy.",
      );
      return;
    }

    // Apple / other — demo only when explicitly enabled
    if (demoEnabled) {
      setProvider(next);
      return;
    }
    setError("Only Google sign-in is available.");
  }

  function closePicker() {
    setProvider(null);
    setError("");
    setLoadingRole(null);
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
          <AuthPageHeader title="Sign in" />
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
                onCancel={closePicker}
              />
            </motion.div>
          ) : (
            <motion.div
              key="buttons"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <SocialSignInButton
                provider="google"
                onClick={() => openProvider("google")}
                isLoading={googleLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {error ? (
          <motion.p
            variants={authItemVariants}
            role="alert"
            className="mt-4 text-[13px] leading-relaxed text-red-600"
          >
            {error}
          </motion.p>
        ) : null}

        {/* Access + legal — single clean stack */}
        <motion.div
          variants={authItemVariants}
          className="mt-8 space-y-4 border-t border-black/[0.06] pt-6"
        >
          <p className="text-[13px] leading-relaxed text-neutral-500">
            Only{" "}
            <span className="font-medium text-neutral-800">
              @{SCHOOL_EMAIL_DOMAIN}
            </span>{" "}
            addresses on the IT allowlist can enter. Gmail and other domains are
            blocked. Ask IT if you need access.
          </p>

          <p className="text-[12px] leading-relaxed text-neutral-400">
            By continuing, you agree to our{" "}
            <Link
              href="/legal/terms"
              className="text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
            >
              Terms
            </Link>
            ,{" "}
            <Link
              href="/legal/privacy"
              className="text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
            >
              Privacy Policy
            </Link>
            , and{" "}
            <Link
              href="/legal/acceptable-use"
              className="text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
            >
              Acceptable Use
            </Link>
            .{" "}
            <Link
              href="/legal/security"
              className="text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
            >
              Security &amp; data safety
            </Link>
            .
          </p>
        </motion.div>
      </motion.div>
    </AuthLayout>
  );
}
