import Link from "next/link";
import { CubicleWordmark } from "@/components/auth/wordmark";
import { LEGAL_LINKS } from "@/lib/legal/constants";
import { cn } from "@/lib/utils";

export function LegalShell({
  title,
  description,
  effectiveDate,
  children,
}: {
  title: string;
  description: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-[#f6f6f7] text-neutral-950">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <CubicleWordmark size="sm" href="/login" />
          <Link
            href="/login"
            className="text-[13px] font-medium text-neutral-600 transition-colors hover:text-neutral-950"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <nav
          aria-label="Legal documents"
          className="mb-8 flex flex-wrap gap-2"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-950",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <article className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
            Legal
          </p>
          <h1 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.03em] text-neutral-950 sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-500">
            {description}
          </p>
          <p className="mt-4 text-[12.5px] text-neutral-400">
            Effective date: {effectiveDate}
          </p>

          <div className="legal-prose mt-10 space-y-8 text-[14.5px] leading-relaxed text-neutral-700">
            {children}
          </div>

          <div className="mt-12 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-[12.5px] leading-relaxed text-amber-950/80">
            <strong className="font-semibold">Notice:</strong> These documents
            describe how Cubicle is designed to operate for authorized school
            staff. They are provided for operational transparency and should be
            reviewed by your school division’s IT, privacy, and legal contacts
            before formal board adoption.
          </div>
        </article>

        <footer className="mt-8 flex flex-col gap-3 border-t border-neutral-200/80 pt-6 text-[12px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cubicle. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-neutral-700"
              >
                {link.label}
              </Link>
            ))}
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
    <section>
      <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-neutral-950">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-neutral-400">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
