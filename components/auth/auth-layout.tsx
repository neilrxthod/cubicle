import Link from "next/link";
import { cn } from "@/lib/utils";
import { LEGAL_LINKS } from "@/lib/legal/constants";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/auth/school-domain";
import { CubicleWordmark } from "./wordmark";

type AuthLayoutProps = {
  children: React.ReactNode;
  className?: string;
  /** Lock to viewport (dense forms). */
  noScroll?: boolean;
};

/**
 * Auth shell — quiet canvas, centered panel, refined brand rail on large screens.
 */
export function AuthLayout({
  children,
  className,
  noScroll = false,
}: AuthLayoutProps) {
  return (
    <div
      className={cn(
        "relative flex w-full bg-[#f4f4f5]",
        noScroll ? "h-svh max-h-svh overflow-hidden" : "min-h-svh",
      )}
    >
      {/* Ambient grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.06) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,0,0,0.06),transparent)]"
      />

      <div
        className={cn(
          "relative z-[1] mx-auto flex w-full max-w-6xl flex-1",
          noScroll ? "min-h-0" : "min-h-svh",
          "flex-col lg:flex-row lg:items-stretch lg:gap-0 lg:p-5",
        )}
      >
        {/* Form panel */}
        <section
          className={cn(
            "flex w-full flex-1 flex-col bg-white",
            "lg:max-w-[440px] lg:shrink-0 lg:rounded-2xl lg:border lg:border-black/[0.06] lg:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.12)]",
            "xl:max-w-[460px]",
            noScroll && "min-h-0 overflow-hidden",
          )}
        >
          <div
            className={cn(
              "flex flex-1 flex-col",
              noScroll
                ? "min-h-0 px-6 py-5 sm:px-8"
                : "px-6 py-8 sm:px-10 sm:py-10",
            )}
          >
            <header className="flex shrink-0 items-center justify-between">
              <CubicleWordmark size="md" href="/login" />
              <span className="rounded-full border border-black/[0.06] bg-neutral-50 px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-neutral-500 uppercase">
                Staff
              </span>
            </header>

            <div
              className={cn(
                "mx-auto flex w-full max-w-[360px] flex-1 flex-col",
                noScroll
                  ? "min-h-0 justify-center py-4"
                  : "justify-center py-12 sm:py-16",
                className,
              )}
            >
              {children}
            </div>

            <footer className="shrink-0 border-t border-black/[0.05] pt-5">
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-neutral-400">
                {LEGAL_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="transition-colors hover:text-neutral-800"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] text-neutral-400">
                © {new Date().getFullYear()} Cubicle · Authorized staff only
              </p>
            </footer>
          </div>
        </section>

        {/* Brand rail */}
        <aside
          className={cn(
            "relative hidden flex-1 overflow-hidden lg:flex lg:flex-col lg:justify-between",
            "lg:rounded-2xl lg:ml-5",
            "bg-neutral-950 text-white",
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/[0.06] blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-white/[0.04] blur-3xl"
          />

          <div className="relative z-[1] flex flex-1 flex-col justify-between p-10 xl:p-12">
            <div>
              <p className="text-[11px] font-medium tracking-[0.16em] text-white/40 uppercase">
                School operations
              </p>
              <h2 className="mt-5 max-w-sm text-[2rem] font-semibold leading-[1.15] tracking-[-0.04em] text-white xl:text-[2.25rem]">
                Book carts.
                <br />
                Teach the class.
              </h2>
              <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-white/50">
                Laptop cart scheduling for teachers and IT — built for the
                school day.
              </p>
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                Domain locked · @{SCHOOL_EMAIL_DOMAIN}
              </div>
              <ul className="space-y-2 text-[13px] text-white/45">
                <li className="flex gap-2">
                  <span className="text-white/25">01</span>
                  Google Workspace sign-in only
                </li>
                <li className="flex gap-2">
                  <span className="text-white/25">02</span>
                  IT allowlist required
                </li>
                <li className="flex gap-2">
                  <span className="text-white/25">03</span>
                  Personal Gmail blocked
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
