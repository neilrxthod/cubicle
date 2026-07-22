"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type LegalConsentProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  invalid?: boolean;
  className?: string;
};

/**
 * ReUI c-label-2 pattern — horizontal field with checkbox + legal label.
 */
export function LegalConsent({
  checked,
  onCheckedChange,
  invalid = false,
  className,
}: LegalConsentProps) {
  return (
    <Field
      orientation="horizontal"
      data-invalid={invalid || undefined}
      className={cn("items-start gap-3", className)}
    >
      <Checkbox
        id="auth-legal-consent"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-invalid={invalid || undefined}
        className="mt-0.5"
      />
      <FieldContent>
        <Label
          htmlFor="auth-legal-consent"
          className="cursor-pointer text-[12.5px] font-normal leading-relaxed text-neutral-600"
        >
          I agree to the{" "}
          <Link
            href="/legal/terms"
            className="font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            Terms
          </Link>
          ,{" "}
          <Link
            href="/legal/privacy"
            className="font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            Privacy Policy
          </Link>
          , and{" "}
          <Link
            href="/legal/acceptable-use"
            className="font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            Acceptable Use
          </Link>
          .{" "}
          <Link
            href="/legal/security"
            className="font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            Security &amp; data safety
          </Link>
          .
        </Label>
      </FieldContent>
    </Field>
  );
}
