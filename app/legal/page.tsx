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
      title="Legal & compliance"
      description={`${LEGAL_PRODUCT} publishes terms, privacy, security, and acceptable-use documents for authorized school staff and administrators.`}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
    >
      <div className="grid gap-3">
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 transition-colors hover:border-neutral-300 hover:bg-white"
          >
            <span className="text-[14.5px] font-medium text-neutral-950">
              {link.label}
            </span>
            <span className="text-[13px] text-neutral-400 transition-colors group-hover:text-neutral-700">
              View →
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-[13.5px] leading-relaxed text-neutral-500">
        These materials support professional school deployment. Have your
        division IT and privacy contacts review them before formal policy
        adoption.
      </p>
    </LegalShell>
  );
}
