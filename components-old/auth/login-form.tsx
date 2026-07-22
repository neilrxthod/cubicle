"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { authenticate, DEMO_ACCOUNTS } from "@/lib/auth/credentials";
import type { DemoAccount } from "@/lib/auth/types";
import { AUTH_ROUTES } from "@/lib/auth/constants";
import {
  getDashboardPath,
  getSession,
  setSession,
} from "@/lib/auth/session";
import { authContainerVariants, authItemVariants } from "@/lib/auth/motion";
import { AuthLayout } from "./auth-layout";
import {
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

export default function LoginForm() {
  const router = useRouter();
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [loadingRole, setLoadingRole] = useState<DemoAccount["role"] | null>(
    null,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    const existing = getSession();
    if (existing) {
      router.replace(getDashboardPath(existing.role));
    }
  }, [router]);

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
    setProvider(next);
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
          <AuthPageHeader
            title="Sign in"
            description="Use your school Google or Apple account."
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {provider ? (
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
              className="space-y-3"
            >
              <SocialSignInButton
                provider="google"
                onClick={() => openProvider("google")}
              />
              <SocialSignInButton
                provider="apple"
                onClick={() => openProvider("apple")}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {error ? (
          <motion.p
            variants={authItemVariants}
            role="alert"
            className="mt-4 text-center text-[13.5px] text-red-600"
          >
            {error}
          </motion.p>
        ) : null}

        <motion.div variants={authItemVariants} className="mt-8">
          <AuthFooter
            prompt="No account?"
            linkLabel="Request access"
            href={AUTH_ROUTES.signup}
          />
        </motion.div>
      </motion.div>
    </AuthLayout>
  );
}
