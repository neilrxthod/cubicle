import Link from "next/link";
import { LEGAL_LINKS } from "@/lib/legal/constants";

export function LegalPager({ currentHref }: { currentHref: string }) {
  const index = LEGAL_LINKS.findIndex((link) => link.href === currentHref);
  if (index < 0) return null;

  const prev = index > 0 ? LEGAL_LINKS[index - 1] : null;
  const next =
    index < LEGAL_LINKS.length - 1 ? LEGAL_LINKS[index + 1] : null;

  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Document navigation"
      className="mt-16 grid gap-3 border-t border-neutral-200/80 pt-10 sm:grid-cols-2 sm:gap-4"
    >
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col rounded-2xl border border-neutral-200/80 bg-white px-5 py-4 transition-[border-color,box-shadow,transform] hover:border-neutral-300 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] active:scale-[0.995]"
        >
          <span className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
            Previous
          </span>
          <span className="mt-1.5 text-[14.5px] font-medium tracking-[-0.01em] text-neutral-950 group-hover:text-neutral-700">
            ← {prev.label}
          </span>
        </Link>
      ) : (
        <div className="hidden sm:block" />
      )}

      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col items-end rounded-2xl border border-neutral-200/80 bg-white px-5 py-4 text-right transition-[border-color,box-shadow,transform] hover:border-neutral-300 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] active:scale-[0.995] sm:col-start-2"
        >
          <span className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
            Next
          </span>
          <span className="mt-1.5 text-[14.5px] font-medium tracking-[-0.01em] text-neutral-950 group-hover:text-neutral-700">
            {next.label} →
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
