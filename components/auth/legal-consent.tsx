"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type LegalConsentProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  invalid?: boolean;
  className?: string;
};

const linkClass =
  "font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500";

/**
 * Required legal acceptance before sign-in.
 */
export function LegalConsent({
  checked,
  onCheckedChange,
  invalid = false,
  className,
}: LegalConsentProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="auth-legal-consent"
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-invalid={invalid || undefined}
          aria-required
          className={cn(
            "mt-0.5 shrink-0",
            invalid && "border-red-500",
          )}
        />
        <label
          htmlFor="auth-legal-consent"
          className={cn(
            "cursor-pointer select-none text-[12.5px] leading-[1.5] text-neutral-600",
            invalid && "text-red-700",
          )}
        >
          I agree to the{" "}
          <Link
            href="/legal/terms"
            className={linkClass}
            onClick={(e) => e.stopPropagation()}
          >
            Terms
          </Link>
          ,{" "}
          <Link
            href="/legal/privacy"
            className={linkClass}
            onClick={(e) => e.stopPropagation()}
          >
            Privacy
          </Link>
          ,{" "}
          <Link
            href="/legal/acceptable-use"
            className={linkClass}
            onClick={(e) => e.stopPropagation()}
          >
            Acceptable Use
          </Link>
          {" & "}
          <Link
            href="/legal/security"
            className={linkClass}
            onClick={(e) => e.stopPropagation()}
          >
            Security
          </Link>
          <span className="text-neutral-400"> (required)</span>
        </label>
      </div>
      {invalid ? (
        <p role="alert" className="pl-7 text-[12px] font-medium text-red-600">
          You must accept to sign in.
        </p>
      ) : null}
    </div>
  );
}
