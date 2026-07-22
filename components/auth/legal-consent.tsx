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
  "text-neutral-800 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500";

/**
 * Minimal legal acceptance row.
 */
export function LegalConsent({
  checked,
  onCheckedChange,
  invalid = false,
  className,
}: LegalConsentProps) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <Checkbox
        id="auth-legal-consent"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-invalid={invalid || undefined}
        className={cn(
          "mt-0.5 shrink-0",
          invalid && "border-red-400 aria-invalid:border-red-400",
        )}
      />
      <label
        htmlFor="auth-legal-consent"
        className={cn(
          "cursor-pointer select-none text-[12px] leading-[1.5] text-neutral-500",
          invalid && "text-red-600",
        )}
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
        {" & "}
        <Link href="/legal/security" className={linkClass} onClick={(e) => e.stopPropagation()}>
          Security
        </Link>
      </label>
    </div>
  );
}
