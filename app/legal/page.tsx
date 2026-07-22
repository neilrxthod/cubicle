import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/legal-shell";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LINKS,
  LEGAL_PRODUCT,
} from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Legal",
  description: `Legal and compliance documents for ${LEGAL_PRODUCT}.`,
};

export default function LegalIndexPage() {
  return (
    <LegalShell
      title="Legal"
      description="Clear policies for school staff using Cubicle — access, privacy, security, and acceptable use."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      variant="index"
    >
      <ol className="space-y-3">
        {LEGAL_LINKS.map((link, i) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="group flex items-start gap-4 rounded-2xl border border-neutral-200/70 bg-[#fafafa] px-4 py-4 transition-[background-color,border-color,box-shadow,transform] hover:border-neutral-300 hover:bg-white hover:shadow-[0_8px_30px_-16px_rgba(0,0,0,0.15)] active:scale-[0.995] sm:gap-5 sm:px-5 sm:py-5"
            >
              <span className="mt-0.5 font-mono text-[12px] tabular-nums text-neutral-300">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium tracking-[-0.015em] text-neutral-950">
                  {link.label}
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-neutral-500">
                  {link.description}
                </p>
              </div>
              <span
                aria-hidden
                className="mt-1 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-[13px] leading-relaxed text-neutral-400">
        Effective {LEGAL_EFFECTIVE_DATE}. Review with division IT and privacy
        contacts before formal board adoption.
      </p>
    </LegalShell>
  );
}
