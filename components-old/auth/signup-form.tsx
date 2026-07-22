"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import {
  AUTH_ROUTES,
  authPrimaryButtonClassName,
} from "@/lib/auth/constants";
import { authContainerVariants, authItemVariants } from "@/lib/auth/motion";
import {
  isSchoolEmail,
  passwordStrengthLabel,
  passwordsMatch,
} from "@/lib/auth/validation";
import { AuthLayout } from "./auth-layout";
import {
  AuthDivider,
  AuthFooter,
  AuthPageHeader,
  EmailField,
  GoogleSignInButtonDisabled,
  PasswordField,
  TextField,
} from "./auth-ui";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isSchoolEmail(email)) {
      setError("Use your school email.");
      return;
    }

    if (!passwordsMatch(password, confirmPassword)) {
      setError("Passwords must match (8+ characters).");
      return;
    }

    if (!acceptedTerms) {
      setError("Accept the terms to continue.");
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 750));
    router.push(
      `${AUTH_ROUTES.verifyEmail}?email=${encodeURIComponent(email.trim())}`,
    );
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
            title="Create account"
            description="Request access for school staff."
          />
        </motion.div>

        <motion.div variants={authItemVariants} className="mb-5">
          <GoogleSignInButtonDisabled label="Continue with Google" />
        </motion.div>

        <motion.div variants={authItemVariants} className="mb-5">
          <AuthDivider />
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div variants={authItemVariants}>
            <TextField
              id="name"
              label="Full name"
              value={name}
              onChange={setName}
              placeholder="Sarah Chen"
              autoComplete="name"
            />
          </motion.div>

          <motion.div variants={authItemVariants}>
            <EmailField value={email} onChange={setEmail} />
          </motion.div>

          <motion.div variants={authItemVariants}>
            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="Create a password"
              hint={passwordStrengthLabel(password)}
            />
          </motion.div>

          <motion.div variants={authItemVariants}>
            <PasswordField
              id="confirm-password"
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              placeholder="Re-enter your password"
            />
          </motion.div>

          <motion.label
            variants={authItemVariants}
            className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-neutral-600"
          >
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-0.5 size-4 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-900"
            />
            <span>
              I agree to the{" "}
              <Link
                href="#"
                className="font-medium text-neutral-950 underline-offset-4 hover:underline"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="#"
                className="font-medium text-neutral-950 underline-offset-4 hover:underline"
              >
                Privacy
              </Link>
            </span>
          </motion.label>

          {error ? (
            <motion.p
              variants={authItemVariants}
              role="alert"
              className="text-[13.5px] text-red-600"
            >
              {error}
            </motion.p>
          ) : null}

          <motion.div variants={authItemVariants} className="pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className={authPrimaryButtonClassName}
            >
              {isLoading ? "Creating…" : "Create account"}
            </button>
          </motion.div>
        </form>

        <motion.div variants={authItemVariants} className="mt-8">
          <AuthFooter
            prompt="Have an account?"
            linkLabel="Sign in"
            href={AUTH_ROUTES.login}
          />
        </motion.div>
      </motion.div>
    </AuthLayout>
  );
}
