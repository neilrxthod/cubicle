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
      <path d="M16.365 1.43c0 1.14-.493 2.058-1.285 2.715-.84.696-1.925 1.103-3.08 1.037-.12-1.09.47-2.226 1.236-2.878.84-.712 2.015-1.238 3.129-1.274zM20.88 17.203c-.735 1.083-1.61 2.154-2.923 2.17-1.255.015-1.658-.734-3.098-.734-1.439 0-1.888.717-3.078.749-1.296.033-2.285-1.098-3.022-2.18-1.644-2.33-2.905-6.585-1.21-9.45.837-1.473 2.333-2.404 3.963-2.428 1.238-.024 2.405.832 3.098.832.693 0 1.998-1.027 3.368-.877.573.024 2.185.231 3.218 1.734-.084.052-1.921 1.122-1.904 3.35.034 2.64 2.312 3.527 2.337 3.538-.019.055-.364 1.247-1.169 2.696z" />
    </svg>
  );
}

const ssoButtonBase =
  "relative flex h-12 w-full items-center justify-center gap-3 rounded-xl px-4 text-[15px] font-medium tracking-[-0.011em] transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50";

type SocialSignInButtonProps = {
  provider: AuthProvider;
  onClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function SocialSignInButton({
  provider,
  onClick,
  isLoading = false,
  disabled = false,
  className,
}: SocialSignInButtonProps) {
  const isGoogle = provider === "google";
  const label = isGoogle ? "Continue with Google" : "Continue with Apple";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        ssoButtonBase,
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
              "size-[18px] animate-spin rounded-full border-2",
              isGoogle
                ? "border-neutral-200 border-t-neutral-800"
                : "border-white/25 border-t-white",
            )}
          />
          Connecting…
        </>
      ) : (
        <>
          <span className="absolute left-4 flex size-5 items-center justify-center">
            {isGoogle ? <GoogleIcon /> : <AppleIcon />}
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
}: {
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <header className="space-y-2">
      <h1 className="text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.03em] text-neutral-950 sm:text-[1.75rem]">
        {title}
      </h1>
      {description ? (
        <p className="text-[14.5px] leading-relaxed text-neutral-500">
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
