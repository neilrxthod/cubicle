"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import {
  AUTH_ROUTES,
  authPrimaryButtonClassName,
} from "@/lib/auth/constants";
import { authContainerVariants, authItemVariants } from "@/lib/auth/motion";
import { isSchoolEmail } from "@/lib/auth/validation";
import { AuthLayout } from "./auth-layout";
import {
  AuthFooter,
  AuthPageHeader,
  AuthSuccess,
  EmailField,
} from "./auth-ui";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 700));

    if (!isSchoolEmail(email)) {
      setError("Enter a valid email.");
      setIsLoading(false);
      return;
    }

    setSent(true);
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
          <AuthPageHeader
            title="Reset password"
            description="Enter your school email and we’ll send a link."
          />
        </motion.div>

        {sent ? (
          <motion.div variants={authItemVariants} className="space-y-5">
            <AuthSuccess
              title="Email sent"
              description={
                <>
                  Check <span className="font-medium">{email}</span> for a reset
                  link.
                </>
              }
            />

            <Link
              href={`${AUTH_ROUTES.resetPassword}?email=${encodeURIComponent(email)}`}
              className={authPrimaryButtonClassName}
            >
              Continue to reset
            </Link>

            <AuthFooter
              prompt="Back to"
              linkLabel="Sign in"
              href={AUTH_ROUTES.login}
            />
          </motion.div>
        ) : (
          <>
            <motion.form
              variants={authItemVariants}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <EmailField value={email} onChange={setEmail} />

              {error ? (
                <p role="alert" className="text-[13.5px] text-red-600">
                  {error}
                </p>
              ) : null}

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={authPrimaryButtonClassName}
                >
                  {isLoading ? "Sending…" : "Send link"}
                </button>
              </div>
            </motion.form>

            <motion.div variants={authItemVariants} className="mt-8">
              <AuthFooter
                prompt="Back to"
                linkLabel="Sign in"
                href={AUTH_ROUTES.login}
              />
            </motion.div>
          </>
        )}
      </motion.div>
    </AuthLayout>
  );
}
