import Link from "next/link";
import { CubicleWordmark } from "@/components/auth/wordmark";
import { LegalNav } from "@/components/legal/legal-nav";
import { LEGAL_LINKS } from "@/lib/legal/constants";

/**
 * Legal chrome — Tesla product: light display titles, pure-type nav,
 * hairline rules, open tracking. No pill chrome.
 */
export function LegalShell({
  title,
  description,
  effectiveDate,
  children,
  /** Index page uses a lighter chrome (no long prose header stack). */
  variant = "document",
}: {
  title: string;
  description: string;
  effectiveDate: string;
  children: React.ReactNode;
  variant?: "document" | "index";
}) {
  return (
    <div className="min-h-svh bg-[var(--canvas,#f4f4f5)] text-neutral-950">
      {/* Top bar — matches product header language */}
      <header className="sticky top-0 z-20 border-b border-[var(--hairline)] bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <CubicleWordmark size="sm" href="/login" />
          <div className="flex items-center gap-1">
            <Link
              href="/about"
              className="hidden px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400 transition-colors duration-200 hover:text-neutral-950 sm:inline"
            >
              About
            </Link>
            <Link
              href="/login"
              className="hidden px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400 transition-colors duration-200 hover:text-neutral-950 sm:inline"
            >
              Back to sign in
            </Link>
            <span
              aria-hidden
              className="mx-1.5 hidden h-3.5 w-px bg-[var(--hairline-strong)] sm:block"
            />
            <Link
              href="/login"
              className="inline-flex h-9 items-center px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-950 transition-colors duration-200 hover:text-neutral-500"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-20">
          {/* Side nav — desktop */}
          <aside className="mb-10 hidden lg:block">
            <div className="sticky top-24">
              <p className="mb-3 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                Legal
              </p>
              <LegalNav orientation="vertical" />
            </div>
          </aside>

          {/* Main document surface */}
          <div className="min-w-0 rounded-xl border border-[var(--hairline-strong)] bg-white px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            {/* Mobile nav */}
            <div className="mb-8 border-b border-[var(--hairline)] pb-6 lg:hidden">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                Legal
              </p>
              <LegalNav orientation="horizontal" />
            </div>

            <header className="max-w-2xl">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                {variant === "index" ? "Policies" : "Document"}
              </p>
              <h1 className="type-page-title mt-2 text-neutral-950">
                {title}
              </h1>
              <p className="mt-3 max-w-xl text-[13.5px] font-normal leading-relaxed tracking-[-0.005em] text-neutral-400 sm:text-[14px]">
                {description}
              </p>
              {variant === "document" ? (
                <p className="mt-4 text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                  Effective{" "}
                  <span className="tracking-normal text-neutral-500">
                    {effectiveDate}
                  </span>
                </p>
              ) : null}
            </header>

            <div
              className={
                variant === "document"
                  ? "mt-10 max-w-2xl border-t border-[var(--hairline)] pt-8 sm:mt-12 sm:pt-10"
                  : "mt-8 max-w-2xl sm:mt-10"
              }
            >
              {children}
            </div>

            {variant === "document" ? (
              <p className="mt-12 max-w-2xl border-t border-[var(--hairline)] pt-8 text-[12.5px] leading-relaxed text-neutral-400 sm:mt-14">
                For authorized school staff. Review with your division IT and
                privacy contacts before formal board adoption.
              </p>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 flex flex-col items-start gap-4 border-t border-[var(--hairline)] pt-8 sm:mt-16 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            <span className="text-neutral-300">©</span>{" "}
            {new Date().getFullYear()}{" "}
            <span className="tracking-[0.2em] text-neutral-500">Cubicle</span>
          </p>
          <nav
            aria-label="Legal documents"
            className="flex flex-wrap items-center gap-x-0 gap-y-2"
          >
            {LEGAL_LINKS.map((link, index) => (
              <span key={link.href} className="inline-flex items-center">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className="mx-2.5 h-2.5 w-px bg-neutral-200 sm:mx-3"
                  />
                ) : null}
                <Link
                  href={link.href}
                  className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-400 transition-colors duration-200 hover:text-neutral-950"
                >
                  {link.shortLabel}
                </Link>
              </span>
            ))}
            <span className="inline-flex items-center">
              <span
                aria-hidden
                className="mx-2.5 h-2.5 w-px bg-neutral-200 sm:mx-3"
              />
              <Link
                href="/login"
                className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-400 transition-colors duration-200 hover:text-neutral-950"
              >
                Sign in
              </Link>
            </span>
          </nav>
        </footer>
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-28 border-b border-[var(--hairline)] py-7 first:pt-0 last:border-b-0 last:pb-0 sm:py-8">
      <h2 className="text-[12px] font-medium uppercase tracking-[0.1em] text-neutral-950 sm:text-[12.5px]">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-[14px] leading-[1.7] tracking-[-0.005em] text-neutral-500 sm:text-[14.5px] [&_a]:font-medium [&_a]:text-neutral-950 [&_a]:underline [&_a]:decoration-neutral-300 [&_a]:underline-offset-[3px] [&_a]:transition-colors [&_a]:hover:decoration-neutral-950 [&_strong]:font-medium [&_strong]:text-neutral-800">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            aria-hidden
            className="mt-[0.65em] size-1 shrink-0 rounded-[1px] bg-neutral-300"
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}
