import Link from "next/link";
import { CubicleWordmark } from "@/components/auth/wordmark";
import { LegalNav } from "@/components/legal/legal-nav";
import { LegalPager } from "@/components/legal/legal-pager";
import { LEGAL_LINKS } from "@/lib/legal/constants";

export function LegalShell({
  title,
  description,
  effectiveDate,
  children,
  variant = "document",
  currentHref,
}: {
  title: string;
  description: string;
  effectiveDate: string;
  children: React.ReactNode;
  variant?: "document" | "index";
  /** Used for prev/next pager on document pages */
  currentHref?: string;
}) {
  return (
    <div className="relative min-h-svh bg-[#fafafa] text-neutral-950">
      {/* Soft depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,0,0,0.045),transparent)]"
      />

      <header className="sticky top-0 z-30 border-b border-black/[0.04] bg-[#fafafa]/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <div className="flex items-center gap-3">
            <CubicleWordmark size="sm" href="/login" />
            <span className="hidden h-4 w-px bg-neutral-200 sm:block" />
            <span className="hidden text-[13px] text-neutral-400 sm:inline">
              Legal
            </span>
          </div>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-full bg-neutral-950 px-4 text-[13px] font-medium tracking-[-0.01em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-[background-color,transform] hover:bg-neutral-800 active:scale-[0.98]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-14 xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-16">
          {/* Sidebar */}
          <aside className="mb-10 hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-2xl border border-black/[0.05] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <p className="mb-2 px-3 pt-2 text-[10.5px] font-medium tracking-[0.16em] text-neutral-400 uppercase">
                  Documents
                </p>
                <LegalNav orientation="vertical" />
              </div>
              <p className="px-1 text-[12px] leading-relaxed text-neutral-400">
                Authorized staff only.
                <br />
                @{/* keep domain readable without import noise */}
                rbe.sk.ca · allowlist required
              </p>
            </div>
          </aside>

          {/* Content column */}
          <div className="min-w-0">
            <div className="mb-8 lg:hidden">
              <LegalNav orientation="horizontal" />
            </div>

            <article className="overflow-hidden rounded-[1.25rem] border border-black/[0.05] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_24px_48px_-28px_rgba(0,0,0,0.12)]">
              {/* Document masthead */}
              <div className="border-b border-neutral-100 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
                    Policy
                  </span>
                  {variant === "document" ? (
                    <span className="text-[12px] text-neutral-400">
                      Effective {effectiveDate}
                    </span>
                  ) : (
                    <span className="text-[12px] text-neutral-400">
                      Updated {effectiveDate}
                    </span>
                  )}
                </div>

                <h1 className="mt-5 max-w-xl text-[2rem] font-semibold leading-[1.12] tracking-[-0.045em] text-neutral-950 sm:text-[2.5rem]">
                  {title}
                </h1>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-neutral-500 sm:text-[15.5px]">
                  {description}
                </p>
              </div>

              {/* Body */}
              <div className="px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
                <div className="max-w-[40rem]">{children}</div>

                {variant === "document" && currentHref ? (
                  <div className="max-w-[40rem]">
                    <LegalPager currentHref={currentHref} />
                  </div>
                ) : null}

                {variant === "document" ? (
                  <p className="mt-12 max-w-[40rem] text-[12.5px] leading-relaxed text-neutral-400">
                    Cubicle is for authorized school staff. Have your division
                    IT and privacy contacts review these documents before formal
                    board adoption.
                  </p>
                ) : null}
              </div>
            </article>
          </div>
        </div>

        <footer className="mt-14 flex flex-col gap-4 border-t border-black/[0.05] pt-8 sm:mt-16 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-neutral-400">
            © {new Date().getFullYear()} Cubicle
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-neutral-400">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-neutral-700"
              >
                {link.shortLabel}
              </Link>
            ))}
            <Link
              href="/login"
              className="transition-colors hover:text-neutral-700"
            >
              Sign in
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Split "1. Title" into index + label for cleaner section headers */
function parseSectionTitle(title: string): { index?: string; label: string } {
  const match = title.match(/^(\d+)\.\s*(.+)$/);
  if (!match) return { label: title };
  return { index: match[1], label: match[2] };
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { index, label } = parseSectionTitle(title);

  return (
    <section className="scroll-mt-28 py-7 first:pt-0 last:pb-0">
      <div className="flex items-baseline gap-3">
        {index ? (
          <span className="w-6 shrink-0 font-mono text-[12px] tabular-nums text-neutral-300">
            {index.padStart(2, "0")}
          </span>
        ) : null}
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-neutral-950">
          {label}
        </h2>
      </div>
      <div className="mt-3 space-y-3.5 pl-0 text-[14.5px] leading-[1.75] text-neutral-600 sm:pl-9 [&_a]:font-medium [&_a]:text-neutral-950 [&_a]:underline [&_a]:decoration-neutral-300 [&_a]:underline-offset-[3px] hover:[&_a]:decoration-neutral-500 [&_strong]:font-semibold [&_strong]:text-neutral-800">
        {children}
      </div>
      <div className="mt-7 h-px bg-gradient-to-r from-neutral-100 via-neutral-100 to-transparent last:hidden" />
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            aria-hidden
            className="mt-[0.65em] size-1 shrink-0 rounded-full bg-neutral-300"
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}
