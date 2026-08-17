import Link from "next/link";
import type { Metadata } from "next";
import { CubicleWordmark } from "@/components/auth/wordmark";
import { JsonLd } from "@/components/seo/json-ld";
import {
  publicPageMetadata,
  SEO_DESCRIPTION,
  SEO_FAQS,
  SEO_NAME,
  SEO_TAGLINE,
  websiteJsonLd,
} from "@/lib/seo";
import { LEGAL_SCHOOL_DOMAIN } from "@/lib/legal/constants";

export const metadata: Metadata = publicPageMetadata({
  title: "About",
  description: SEO_DESCRIPTION,
  path: "/about",
});

const STEPS = [
  {
    title: "Sign in with school Google",
    body: `Only allowlisted @${LEGAL_SCHOOL_DOMAIN} accounts can enter. There is no public sign-up.`,
  },
  {
    title: "Book a cart by period",
    body: "The daily board shows every cart against the bell schedule. Reserve an open slot, or request a share or swap.",
  },
  {
    title: "Report issues, get email",
    body: "Teachers flag broken machines. Admins get notified. Staff can also get email when a booking moves, cancels, or is shared.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="min-h-svh bg-[var(--canvas,#f4f4f5)] text-neutral-950">
      <JsonLd data={websiteJsonLd()} />
      <header className="sticky top-0 z-20 border-b border-[var(--hairline)] bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <CubicleWordmark size="sm" href="/about" />
          <nav className="flex items-center gap-1">
            <Link
              href="/legal"
              className="hidden px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400 transition-colors hover:text-neutral-950 sm:inline"
            >
              Legal
            </Link>
            <Link
              href="/login"
              className="inline-flex h-9 items-center px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-950 transition-colors hover:text-neutral-500"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
          {SEO_NAME}
        </p>
        <h1 className="mt-3 text-[34px] font-medium leading-[1.12] tracking-[-0.035em] text-neutral-950 sm:text-[44px]">
          {SEO_TAGLINE}
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed tracking-[-0.01em] text-neutral-500">
          {SEO_DESCRIPTION}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-full bg-neutral-950 px-5 text-[13.5px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
          <Link
            href="/legal"
            className="inline-flex h-11 items-center rounded-full border border-neutral-200 bg-white px-5 text-[13.5px] font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
          >
            Legal
          </Link>
        </div>

        <ol className="mt-16 border-y border-[var(--hairline)]">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className={
                index > 0
                  ? "border-t border-[var(--hairline)] py-7"
                  : "py-7"
              }
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-2 text-[18px] font-medium tracking-[-0.02em] text-neutral-950">
                {step.title}
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-neutral-500">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <section className="mt-16" aria-labelledby="faq-heading">
          <h2
            id="faq-heading"
            className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400"
          >
            Questions
          </h2>
          <dl className="mt-6 space-y-8">
            {SEO_FAQS.map((item) => (
              <div key={item.question}>
                <dt className="text-[16px] font-medium tracking-[-0.02em] text-neutral-950">
                  {item.question}
                </dt>
                <dd className="mt-2 text-[14.5px] leading-relaxed text-neutral-500">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
