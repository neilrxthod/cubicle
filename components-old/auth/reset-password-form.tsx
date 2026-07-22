"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import {
  AUTH_ROUTES,
  authPrimaryButtonClassName,
} from "@/lib/auth/constants";
import { authContainerVariants, authItemVariants } from "@/lib/auth/motion";
import { passwordsMatch } from "@/lib/auth/validation";
import { AuthLayout } from "./auth-layout";
import {
  AuthFooter,
  AuthPageHeader,
  AuthSuccess,
  PasswordField,
} from "./auth-ui";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "preview";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!passwordsMatch(password, confirmPassword)) {
      setError("Passwords must match (8+ characters).");
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setDone(true);
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
            title="New password"
            description={
              email
                ? `Choose a new password for ${email}.`
                : "Choose a new password for your account."
            }
          />
        </motion.div>

        {done ? (
          <motion.div variants={authItemVariants} className="space-y-5">
            <AuthSuccess
              title="Password updated"
              description="You can sign in with your new password."
            />

            <Link href={AUTH_ROUTES.login} className={authPrimaryButtonClassName}>
              Sign in
            </Link>
          </motion.div>
        ) : (
          <>
            <motion.form
              variants={authItemVariants}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <input type="hidden" name="token" value={token} readOnly />

              <PasswordField
                id="password"
                label="New password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                placeholder="Create a new password"
                hint="8+ characters"
              />

              <PasswordField
                id="confirm-password"
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                placeholder="Re-enter your password"
              />

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
                  {isLoading ? "Updating…" : "Update password"}
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
