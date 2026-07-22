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
      description="Policies for authorized school staff using Cubicle."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      variant="index"
    >
      <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
        {LEGAL_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="group flex items-baseline justify-between gap-6 py-5 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-medium tracking-[-0.01em] text-neutral-950 group-hover:text-neutral-700">
                  {link.label}
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-neutral-500">
                  {link.description}
                </p>
              </div>
              <span
                aria-hidden
                className="shrink-0 text-[14px] text-neutral-300 transition-colors group-hover:text-neutral-500"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-[13px] leading-relaxed text-neutral-400">
        Effective {LEGAL_EFFECTIVE_DATE}. Review with division IT and privacy
        contacts before formal board adoption.
      </p>
    </LegalShell>
  );
}
