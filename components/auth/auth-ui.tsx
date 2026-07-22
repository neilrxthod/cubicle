"use client";

import Link from "next/link";
import { useState } from "react";
import { authFieldClassName } from "@/lib/auth/constants";
import { cn } from "@/lib/utils";

export type AuthProvider = "google" | "apple";

export function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Apple logo mark — standard silhouette used for Sign in with Apple.
 * Fills with currentColor (white on the black button).
 */
export function AppleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="currentColor"
      {...props}
    >
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zm3.378-3.066c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z" />
    </svg>
  );
}

const ssoButtonBase =
  "relative flex w-full items-center justify-center gap-2.5 rounded-xl px-3 font-medium tracking-[-0.011em] transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50";

type SocialSignInButtonProps = {
  provider: AuthProvider;
  onClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  /** Smaller control for dense layouts (e.g. signup). */
  compact?: boolean;
};

export function SocialSignInButton({
  provider,
  onClick,
  isLoading = false,
  disabled = false,
  className,
  compact = false,
}: SocialSignInButtonProps) {
  const isGoogle = provider === "google";
  const label = isGoogle
    ? compact
      ? "Google"
      : "Continue with Google"
    : compact
      ? "Apple"
      : "Continue with Apple";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        ssoButtonBase,
        compact ? "h-10 rounded-lg text-[13px]" : "h-12 gap-3 px-4 text-[15px]",
        isGoogle
          ? "border border-black/[0.08] bg-white text-neutral-900 hover:bg-neutral-50 hover:border-black/[0.12]"
          : "bg-neutral-950 text-white hover:bg-neutral-800",
        className,
      )}
    >
      {isLoading ? (
        <>
          <span
            className={cn(
              "animate-spin rounded-full border-2",
              compact ? "size-4" : "size-[18px]",
              isGoogle
                ? "border-neutral-200 border-t-neutral-800"
                : "border-white/25 border-t-white",
            )}
          />
          {compact ? "..." : "Connecting…"}
        </>
      ) : (
        <>
          <span
            className={cn(
              "flex items-center justify-center",
              compact
                ? "size-4 shrink-0"
                : "absolute left-4 size-5",
            )}
          >
            {isGoogle ? (
              <GoogleIcon width={compact ? 16 : 18} height={compact ? 16 : 18} />
            ) : (
              <AppleIcon
                width={compact ? 16 : 18}
                height={compact ? 16 : 18}
              />
            )}
          </span>
          {label}
        </>
      )}
    </button>
  );
}

export function GoogleSignInButtonDisabled({
  label = "Coming soon",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled
      className={cn(
        ssoButtonBase,
        "cursor-not-allowed border border-black/[0.06] bg-neutral-50 text-neutral-400",
      )}
    >
      <span className="absolute left-4 flex size-5 items-center justify-center opacity-60">
        <GoogleIcon />
      </span>
      {label}
    </button>
  );
}

/** @deprecated Use SocialSignInButton */
export function GoogleSignInButton({
  onClick,
  isLoading,
  disabled,
  className,
}: {
  onClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <SocialSignInButton
      provider="google"
      onClick={onClick}
      isLoading={isLoading}
      disabled={disabled}
      className={className}
    />
  );
}

export function AuthDivider() {
  return (
    <div className="relative flex items-center gap-3">
      <div className="h-px flex-1 bg-neutral-200" />
      <span className="text-[12px] text-neutral-400">or</span>
      <div className="h-px flex-1 bg-neutral-200" />
    </div>
  );
}

type AuthFooterProps = {
  prompt: string;
  linkLabel: string;
  href: string;
};

export function AuthFooter({ prompt, linkLabel, href }: AuthFooterProps) {
  return (
    <p className="text-center text-[14px] text-neutral-500">
      {prompt}{" "}
      <Link
        href={href}
        className="font-medium text-neutral-950 underline-offset-4 transition-opacity hover:opacity-70 hover:underline"
      >
        {linkLabel}
      </Link>
    </p>
  );
}

type AccountOption = {
  name: string;
  email: string;
  roleLabel: string;
  accent: string;
  onSelect: () => void;
  isLoading?: boolean;
};

export function SocialAccountPicker({
  provider,
  accounts,
  onCancel,
}: {
  provider: AuthProvider;
  accounts: AccountOption[];
  onCancel?: () => void;
}) {
  const providerLabel = provider === "google" ? "Google" : "Apple";

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
      <div className="flex items-center gap-3 border-b border-black/[0.05] px-4 py-3.5">
        {provider === "google" ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-neutral-50 ring-1 ring-black/[0.06]">
            <GoogleIcon className="size-4" />
          </span>
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-neutral-950 text-white">
            <AppleIcon className="size-3.5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[14px] font-medium tracking-[-0.01em] text-neutral-950">
            Choose an account
          </p>
          <p className="text-[12.5px] text-neutral-500">
            to continue with {providerLabel}
          </p>
        </div>
      </div>

      <ul>
        {accounts.map((account, index) => (
          <li
            key={account.email}
            className={cn(index > 0 && "border-t border-black/[0.05]")}
          >
            <button
              type="button"
              onClick={account.onSelect}
              disabled={account.isLoading}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white",
                  account.accent,
                )}
              >
                {account.isLoading ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  account.name.charAt(0)
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-neutral-950">
                  {account.name}
                </span>
                <span className="block truncate text-[12.5px] text-neutral-500">
                  {account.email}
                </span>
              </span>
              <span className="shrink-0 text-[12px] font-medium text-neutral-400">
                {account.roleLabel}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {onCancel ? (
        <div className="border-t border-black/[0.05] bg-neutral-50/70 px-4 py-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-950"
          >
            ← Back
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use SocialAccountPicker */
export function GoogleAccountPicker({
  accounts,
  onCancel,
}: {
  accounts: AccountOption[];
  onCancel?: () => void;
}) {
  return (
    <SocialAccountPicker provider="google" accounts={accounts} onCancel={onCancel} />
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  placeholder = "Enter your password",
  hint,
  forgotHref,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  forgotHref?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="text-[13px] font-medium tracking-[-0.01em] text-neutral-700"
        >
          {label}
        </label>
        {forgotHref ? (
          <Link
            href={forgotHref}
            className="text-[12.5px] font-medium text-neutral-500 underline-offset-4 transition-colors hover:text-neutral-950 hover:underline"
          >
            Forgot?
          </Link>
        ) : null}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn(authFieldClassName, "pr-14")}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 px-3.5 text-[12.5px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? <p className="text-[12px] text-neutral-400">{hint}</p> : null}
    </div>
  );
}

export function EmailField({
  id = "email",
  label = "Email",
  value,
  onChange,
  placeholder = "you@school.edu",
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-[13px] font-medium tracking-[-0.01em] text-neutral-700"
      >
        {label}
      </label>
      <input
        id={id}
        type="email"
        autoComplete="email"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={authFieldClassName}
      />
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-[13px] font-medium tracking-[-0.01em] text-neutral-700"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={authFieldClassName}
      />
    </div>
  );
}

export function AuthPageHeader({
  title,
  description,
  compact = false,
}: {
  title: string;
  description?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <header className={cn(compact ? "space-y-1" : "space-y-2")}>
      <h1
        className={cn(
          "font-semibold leading-[1.15] tracking-[-0.03em] text-neutral-950",
          compact
            ? "text-[1.35rem] sm:text-[1.45rem]"
            : "text-[1.625rem] sm:text-[1.75rem]",
        )}
      >
        {title}
      </h1>
      {description ? (
        <p
          className={cn(
            "leading-relaxed text-neutral-500",
            compact ? "text-[13px]" : "text-[14.5px]",
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function AuthSuccess({
  title,
  description,
}: {
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3.5">
      <p className="text-[13.5px] font-medium tracking-[-0.01em] text-emerald-900">
        {title}
      </p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-emerald-800/85">
        {description}
      </p>
    </div>
  );
}
