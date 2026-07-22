"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AUTH_ROUTES } from "@/lib/auth/constants";
import { authContainerVariants, authItemVariants } from "@/lib/auth/motion";
import { authenticate, DEMO_ACCOUNTS } from "@/lib/auth/credentials";
import type { DemoAccount } from "@/lib/auth/types";
import { getDashboardPath, setSession } from "@/lib/auth/session";
import { isSchoolEmail, passwordsMatch } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";
import { AuthLayout } from "./auth-layout";
import {
  AuthDivider,
  AuthFooter,
  AuthPageHeader,
  SocialAccountPicker,
  SocialSignInButton,
  type AuthProvider,
} from "./auth-ui";

const roleAccent: Record<DemoAccount["role"], string> = {
  teacher: "bg-emerald-600",
  admin: "bg-violet-600",
};

const fieldClass =
  "w-full h-10 rounded-lg border border-black/[0.08] bg-[#fafafa] px-3 text-[14px] tracking-[-0.011em] text-neutral-900 placeholder:text-neutral-400 outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:bg-white hover:border-black/[0.12] focus:bg-white focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/[0.08]";

const ctaClass =
  "inline-flex h-10 w-full items-center justify-center rounded-lg bg-neutral-950 px-5 text-[14px] font-medium tracking-[-0.011em] text-white transition-[background-color,opacity] duration-150 hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-50";

function passwordScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

function strengthMeta(score: number): { label: string; className: string } {
  if (score <= 1) return { label: "Weak", className: "bg-red-400" };
  if (score === 2) return { label: "Fair", className: "bg-amber-400" };
  if (score === 3) return { label: "Good", className: "bg-emerald-400" };
  return { label: "Strong", className: "bg-emerald-500" };
}

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [loadingRole, setLoadingRole] = useState<DemoAccount["role"] | null>(
    null,
  );

  // Hide the page scrollbar while signup is mounted (global html uses overflow-y: scroll).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflowY;
    const prevBody = body.style.overflowY;
    const prevGutter = html.style.scrollbarGutter;
    html.style.overflowY = "hidden";
    body.style.overflowY = "hidden";
    html.style.scrollbarGutter = "auto";
    return () => {
      html.style.overflowY = prevHtml;
      body.style.overflowY = prevBody;
      html.style.scrollbarGutter = prevGutter;
    };
  }, []);

  const score = useMemo(() => passwordScore(password), [password]);
  const strength = strengthMeta(score);
  const passwordsOk =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    passwordsMatch(password, confirmPassword);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (!isSchoolEmail(email)) {
      setError("Use a valid school email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!passwordsMatch(password, confirmPassword)) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setError("Accept the Terms and Privacy Policy to continue.");
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    router.push(
      `${AUTH_ROUTES.verifyEmail}?email=${encodeURIComponent(email.trim())}`,
    );
  }

  async function signInWithAccount(account: DemoAccount) {
    setError("");
    setLoadingRole(account.role);
    await new Promise((resolve) => setTimeout(resolve, 550));
    const user = authenticate(account.email, account.password);
    if (!user) {
      setError("Could not continue with that account.");
      setLoadingRole(null);
      return;
    }
    setSession(user);
    router.push(getDashboardPath(user.role));
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
    <AuthLayout noScroll>
      <motion.div
        variants={authContainerVariants}
        initial={false}
        animate="visible"
        className="w-full"
      >
        <motion.div variants={authItemVariants} className="mb-3.5">
          <AuthPageHeader
            title="Create account"
            description="SSO or email — school staff only."
            compact
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {provider ? (
            <motion.div
              key="picker"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.15 }}
            >
              <SocialAccountPicker
                provider={provider}
                accounts={accountOptions}
                onCancel={() => {
                  setProvider(null);
                  setLoadingRole(null);
                  setError("");
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <SocialSignInButton
                  provider="google"
                  compact
                  onClick={() => {
                    setError("");
                    setProvider("google");
                  }}
                />
                <SocialSignInButton
                  provider="apple"
                  compact
                  onClick={() => {
                    setError("");
                    setProvider("apple");
                  }}
                />
              </div>

              <AuthDivider />

              <form onSubmit={handleSubmit} className="space-y-2.5">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="name"
                      className="text-[12px] font-medium text-neutral-600"
                    >
                      Full name
                    </label>
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Sarah Chen"
                      className={fieldClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="email"
                      className="text-[12px] font-medium text-neutral-600"
                    >
                      Work email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@school.edu"
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="password"
                    className="text-[12px] font-medium text-neutral-600"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8+ characters"
                      className={cn(fieldClass, "pr-12")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 px-3 text-[12px] font-medium text-neutral-500 hover:text-neutral-900"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {password.length > 0 ? (
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="flex flex-1 gap-0.5">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-0.5 flex-1 rounded-full",
                              i < score ? strength.className : "bg-neutral-200",
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-neutral-500">
                        {strength.label}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="confirm-password"
                    className="text-[12px] font-medium text-neutral-600"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={cn(
                      fieldClass,
                      confirmPassword.length > 0 &&
                        (passwordsOk
                          ? "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/15"
                          : "border-red-200 focus:border-red-400 focus:ring-red-500/10"),
                    )}
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200/80 bg-neutral-50/50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 size-3.5 shrink-0 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-900/20"
                  />
                  <span className="text-[12px] leading-snug text-neutral-600">
                    I agree to the{" "}
                    <Link
                      href="#"
                      className="font-medium text-neutral-950 underline-offset-2 hover:underline"
                    >
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="#"
                      className="font-medium text-neutral-950 underline-offset-2 hover:underline"
                    >
                      Privacy
                    </Link>
                    .
                  </span>
                </label>

                {error ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
                  >
                    {error}
                  </p>
                ) : null}

                <button type="submit" disabled={isLoading} className={ctaClass}>
                  {isLoading ? "Creating..." : "Create account"}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {!provider ? (
          <motion.div variants={authItemVariants} className="mt-4">
            <AuthFooter
              prompt="Already have an account?"
              linkLabel="Sign in"
              href={AUTH_ROUTES.login}
            />
          </motion.div>
        ) : null}
      </motion.div>
    </AuthLayout>
  );
}
