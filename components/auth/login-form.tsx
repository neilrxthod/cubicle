"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticate, DEMO_ACCOUNTS } from "@/lib/auth/credentials";
import type { DemoAccount } from "@/lib/auth/types";
import {
  getDashboardPath,
  getSession,
  setSession,
} from "@/lib/auth/session";
import {
  GOOGLE_HOSTED_DOMAIN,
  SCHOOL_EMAIL_DOMAIN,
} from "@/lib/auth/school-domain";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AuthLayout } from "./auth-layout";
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
  not_allowed: `Your @${SCHOOL_EMAIL_DOMAIN} account is not on the IT allowlist. Contact IT to be added.`,
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
    if (code) setError(messageForError(code));
  }, [searchParams]);

  async function signInWithGoogle() {
    setError("");
    setGoogleLoading(true);

    if (!supabaseReady) {
      setError(
        "Google sign-in is not configured. Add Supabase keys in Vercel, then redeploy.",
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

  function handlePrimaryClick() {
    setError("");
    if (supabaseReady) {
      void signInWithGoogle();
      return;
    }
    if (demoEnabled) {
      setProvider("google");
      return;
    }
    setError(
      "Google sign-in is not configured. Add Supabase keys in Vercel, then redeploy.",
    );
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full"
      >
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.04em] text-neutral-950 sm:text-[1.875rem]">
            Sign in
          </h1>
          <p className="mt-3 text-[14.5px] leading-[1.55] text-neutral-500">
            School Google only{" "}
            <span className="font-medium text-neutral-800">
              (@{SCHOOL_EMAIL_DOMAIN})
            </span>
            . Your email must also be on the IT allowlist — personal Gmail is
            never accepted.
          </p>
        </div>

        {provider && demoEnabled ? (
          <SocialAccountPicker
            provider={provider}
            accounts={accountOptions}
            onCancel={() => {
              setProvider(null);
              setError("");
              setLoadingRole(null);
            }}
          />
        ) : (
          <div className="space-y-5">
            {/* Primary CTA */}
            <button
              type="button"
              onClick={handlePrimaryClick}
              disabled={googleLoading}
              className={cn(
                "group relative flex h-[52px] w-full items-center justify-center gap-3 rounded-xl",
                "bg-neutral-950 text-[15px] font-medium tracking-[-0.01em] text-white",
                "shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_24px_-8px_rgba(0,0,0,0.35)]",
                "transition-[transform,background-color,box-shadow] duration-150",
                "hover:bg-neutral-800 hover:shadow-[0_1px_2px_rgba(0,0,0,0.08),0_12px_28px_-8px_rgba(0,0,0,0.4)]",
                "active:scale-[0.985]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-55",
              )}
            >
              {googleLoading ? (
                <>
                  <span className="size-[18px] animate-spin rounded-full border-2 border-white/25 border-t-white" />
                  Connecting…
                </>
              ) : (
                <>
                  <span className="flex size-5 items-center justify-center rounded-md bg-white p-0.5">
                    <GoogleIcon width={16} height={16} />
                  </span>
                  Continue with Google
                </>
              )}
            </button>

            {/* Access rules */}
            <div className="rounded-xl border border-black/[0.06] bg-neutral-50/80 px-4 py-3.5">
              <p className="text-[12px] font-medium tracking-wide text-neutral-500 uppercase">
                Access
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
                Only{" "}
                <span className="font-medium text-neutral-900">
                  @{SCHOOL_EMAIL_DOMAIN}
                </span>{" "}
                addresses on the IT allowlist can enter. Gmail and other domains
                are blocked. Ask IT if you need access.
              </p>
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-700"
              >
                {error}
              </div>
            ) : null}

            {/* Legal */}
            <p className="text-center text-[11.5px] leading-relaxed text-neutral-400">
              By continuing, you agree to our{" "}
              <Link
                href="/legal/terms"
                className="text-neutral-600 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:text-neutral-950 hover:decoration-neutral-500"
              >
                Terms
              </Link>
              ,{" "}
              <Link
                href="/legal/privacy"
                className="text-neutral-600 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:text-neutral-950 hover:decoration-neutral-500"
              >
                Privacy Policy
              </Link>
              , and{" "}
              <Link
                href="/legal/acceptable-use"
                className="text-neutral-600 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:text-neutral-950 hover:decoration-neutral-500"
              >
                Acceptable Use
              </Link>
              .{" "}
              <Link
                href="/legal/security"
                className="text-neutral-600 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:text-neutral-950 hover:decoration-neutral-500"
              >
                Security &amp; data safety
              </Link>
              .
            </p>
          </div>
        )}
      </motion.div>
    </AuthLayout>
  );
}
