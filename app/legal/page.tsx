import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/legal-shell";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LINKS,
  LEGAL_PRODUCT,
} from "@/lib/legal/constants";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Legal",
  description: `Legal and compliance documents for ${LEGAL_PRODUCT}.`,
  path: "/legal",
});

export default function LegalIndexPage() {
  return (
    <LegalShell
      title="Legal"
      description="Policies for authorized school staff using Cubicle."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      variant="index"
    >
      <ul className="border-y border-[var(--hairline)]">
        {LEGAL_LINKS.map((link, index) => (
          <li
            key={link.href}
            className={
              index > 0 ? "border-t border-[var(--hairline)]" : undefined
            }
          >
            <Link
              href={link.href}
              className="group flex items-baseline justify-between gap-6 py-5 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-neutral-950 transition-colors group-hover:text-neutral-500">
                  {link.label}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed tracking-[-0.005em] text-neutral-400">
                  {link.description}
                </p>
              </div>
              <span
                aria-hidden
                className="shrink-0 text-[12px] font-light tracking-[0.2em] text-neutral-300 transition-colors group-hover:text-neutral-950"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-400">
        Effective{" "}
        <span className="tracking-normal text-neutral-500">
          {LEGAL_EFFECTIVE_DATE}
        </span>
        <span className="mt-2 block font-normal normal-case tracking-[-0.005em] text-neutral-400">
          Review with division IT and privacy contacts before formal board
          adoption.
        </span>
      </p>
    </LegalShell>
  );
}
