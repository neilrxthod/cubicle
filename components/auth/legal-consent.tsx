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
  "font-medium text-neutral-800 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:text-neutral-950 hover:decoration-neutral-500";

/**
 * Compact legal acceptance — ReUI c-label-2 idea, balanced for auth.
 */
export function LegalConsent({
  checked,
  onCheckedChange,
  invalid = false,
  className,
}: LegalConsentProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3 py-3 transition-colors",
        invalid
          ? "border-red-200 bg-red-50/50"
          : "border-neutral-200/80 bg-neutral-50/60",
        className,
      )}
    >
      <Checkbox
        id="auth-legal-consent"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-invalid={invalid || undefined}
        className="mt-0.5 shrink-0"
      />
      <label
        htmlFor="auth-legal-consent"
        className="cursor-pointer select-none text-[12.5px] leading-[1.55] text-neutral-600"
      >
        I agree to the{" "}
        <Link href="/legal/terms" className={linkClass} onClick={(e) => e.stopPropagation()}>
          Terms
        </Link>
        ,{" "}
        <Link href="/legal/privacy" className={linkClass} onClick={(e) => e.stopPropagation()}>
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
        {" "}
        &{" "}
        <Link href="/legal/security" className={linkClass} onClick={(e) => e.stopPropagation()}>
          Security
        </Link>
        .
      </label>
    </div>
  );
}
