"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type LegalConsentProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  invalid?: boolean;
  /** Increment to re-trigger shake when still invalid */
  shakeKey?: number;
  className?: string;
};

const linkClass =
  "font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-500";

/**
 * Required legal acceptance — minimal row + soft invalid animation.
 */
export function LegalConsent({
  checked,
  onCheckedChange,
  invalid = false,
  shakeKey = 0,
  className,
}: LegalConsentProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <motion.div
        key={invalid ? `legal-invalid-${shakeKey}` : "legal-ok"}
        initial={false}
        animate={
          invalid
            ? {
                x: [0, -5, 4, -2, 1, 0],
                transition: { duration: 0.36, ease: "easeOut" },
              }
            : { x: 0 }
        }
        className={cn(
          "flex items-start gap-2.5 rounded-lg transition-[background-color,box-shadow] duration-200",
          invalid && "bg-red-50/80 px-2 py-1.5 -mx-2",
        )}
      >
        <Checkbox
          id="auth-legal-consent"
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-invalid={invalid || undefined}
          aria-required
          className={cn(
            "mt-0.5 shrink-0 transition-colors duration-200",
            invalid &&
              "border-red-500 ring-2 ring-red-500/15 data-checked:border-neutral-950 data-checked:ring-0",
          )}
        />
        <label
          htmlFor="auth-legal-consent"
          className={cn(
            "cursor-pointer select-none text-[12.5px] leading-[1.5] transition-colors duration-200",
            invalid ? "text-red-700" : "text-neutral-600",
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
        </label>
      </motion.div>

      <AnimatePresence mode="wait">
        {invalid ? (
          <motion.p
            key={`hint-${shakeKey}`}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -2 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden pl-7 text-[12px] font-medium text-red-600"
          >
            You must accept to sign in.
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
