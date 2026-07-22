import Link from "next/link";
import { CubicleWordmark } from "@/components/auth/wordmark";
import { LegalNav } from "@/components/legal/legal-nav";
import { LEGAL_LINKS } from "@/lib/legal/constants";

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
    <div className="min-h-svh bg-white text-neutral-950">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-neutral-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:px-8">
          <CubicleWordmark size="sm" href="/login" />
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden text-[13px] text-neutral-500 transition-colors hover:text-neutral-950 sm:inline"
            >
              Back to sign in
            </Link>
            <Link
              href="/login"
              className="inline-flex h-8 items-center rounded-full bg-neutral-950 px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-neutral-800"
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
              <p className="mb-3 px-3 text-[11px] font-medium tracking-[0.14em] text-neutral-400 uppercase">
                Legal
              </p>
              <LegalNav orientation="vertical" />
            </div>
          </aside>

          {/* Main */}
          <div className="min-w-0">
            {/* Mobile nav */}
            <div className="mb-8 border-b border-neutral-100 pb-6 lg:hidden">
              <p className="mb-2 text-[11px] font-medium tracking-[0.14em] text-neutral-400 uppercase">
                Legal
              </p>
              <LegalNav orientation="horizontal" />
            </div>

            <header className="max-w-2xl">
              <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-neutral-950 sm:text-[2.25rem]">
                {title}
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-neutral-500 sm:text-[15.5px]">
                {description}
              </p>
              {variant === "document" ? (
                <p className="mt-4 text-[12.5px] text-neutral-400">
                  Effective {effectiveDate}
                </p>
              ) : null}
            </header>

            <div
              className={
                variant === "document"
                  ? "mt-12 max-w-2xl border-t border-neutral-100 pt-10"
                  : "mt-10 max-w-2xl"
              }
            >
              {children}
            </div>

            {variant === "document" ? (
              <p className="mt-14 max-w-2xl text-[12.5px] leading-relaxed text-neutral-400">
                For authorized school staff. Review with your division IT and
                privacy contacts before formal board adoption.
              </p>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 flex flex-col gap-4 border-t border-neutral-100 pt-8 sm:mt-24 sm:flex-row sm:items-center sm:justify-between">
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

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-28 border-b border-neutral-100 py-8 first:pt-0 last:border-b-0 last:pb-0">
      <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-neutral-950">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[14.5px] leading-[1.7] text-neutral-600 [&_a]:font-medium [&_a]:text-neutral-950 [&_a]:underline [&_a]:decoration-neutral-300 [&_a]:underline-offset-[3px] [&_a]:hover:decoration-neutral-500 [&_strong]:font-semibold [&_strong]:text-neutral-800">
        {children}
      </div>
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
            className="mt-[0.55em] size-1 shrink-0 rounded-full bg-neutral-300"
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}
