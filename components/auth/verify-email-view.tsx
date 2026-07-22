"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import {
  AUTH_ROUTES,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from "@/lib/auth/constants";
import { authContainerVariants, authItemVariants } from "@/lib/auth/motion";
import { AuthLayout } from "./auth-layout";
import { AuthFooter, AuthPageHeader } from "./auth-ui";

export function VerifyEmailView() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "your email";
  const [resent, setResent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleResend() {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setResent(true);
    setIsLoading(false);
  }

  return (
    <AuthLayout>
      <motion.div
        variants={authContainerVariants}
        initial={false}
        animate="visible"
        className="w-full"
      >
        <motion.div variants={authItemVariants} className="mb-8">
          <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-900 ring-1 ring-black/[0.04]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="size-5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15A2.25 2.25 0 0 0 2.25 6.75m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0l-7.5-4.615a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <AuthPageHeader
            title="Verify email"
            description={
              <>
                Link sent to{" "}
                <span className="font-medium text-neutral-800">{email}</span>.
              </>
            }
          />
        </motion.div>

        <motion.p
          variants={authItemVariants}
          className="mb-6 text-[14px] leading-relaxed text-neutral-500"
        >
          Check spam if you don&apos;t see it, or resend below.
          {resent ? (
            <span className="mt-1.5 block font-medium text-emerald-700">
              New link sent.
            </span>
          ) : null}
        </motion.p>

        <motion.div variants={authItemVariants} className="space-y-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={isLoading || resent}
            className={authSecondaryButtonClassName}
          >
            {isLoading ? "Sending…" : "Resend link"}
          </button>

          <Link href={AUTH_ROUTES.login} className={authPrimaryButtonClassName}>
            Back to sign in
          </Link>
        </motion.div>

        <motion.div variants={authItemVariants} className="mt-8">
          <AuthFooter
            prompt="Wrong email?"
            linkLabel="Sign up again"
            href={AUTH_ROUTES.signup}
          />
        </motion.div>
      </motion.div>
    </AuthLayout>
  );
}
