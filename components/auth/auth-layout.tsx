import Link from "next/link";
import { cn } from "@/lib/utils";
import { CubicleWordmark } from "./wordmark";

type AuthLayoutProps = {
  children: React.ReactNode;
  className?: string;
  /** Lock to viewport and hide page scroll (used by dense forms like signup). */
  noScroll?: boolean;
};

/**
 * Monochrome gradient brand panel — matches onboarding left panel
 * (logo only, no marketing copy).
 */
function AuthBrandPanel({ fullHeight }: { fullHeight: boolean }) {
  return (
    <aside
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-2xl",
        fullHeight ? "h-full" : "h-full min-h-[calc(100svh-1.5rem)]",
      )}
    >
      {/* Premium B&W mesh — same recipe as onboarding */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 100% 80% at 20% 0%, rgba(255,255,255,0.22) 0%, transparent 55%),
            radial-gradient(ellipse 70% 60% at 100% 30%, rgba(255,255,255,0.08) 0%, transparent 50%),
            radial-gradient(ellipse 80% 70% at 50% 100%, rgba(255,255,255,0.06) 0%, transparent 55%),
            linear-gradient(160deg, #1a1a1a 0%, #0a0a0a 40%, #000000 72%, #111111 100%)
          `,
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.09)_0%,transparent_42%,transparent_58%,rgba(255,255,255,0.04)_100%)]" />
      <div className="absolute -top-1/3 left-[-10%] h-[75%] w-[75%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14)_0%,transparent_65%)] blur-3xl" />
      <div className="absolute right-[-20%] bottom-[-15%] h-[60%] w-[60%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.07)_0%,transparent_65%)] blur-3xl" />

      <div className="absolute inset-0 z-10 flex items-center justify-center px-8">
        <CubicleWordmark
          size="hero"
          href={null}
          tone="light"
          className="font-extralight tracking-[0.52em] text-white/92 drop-shadow-[0_1px_24px_rgba(255,255,255,0.12)]"
        />
      </div>
    </aside>
  );
}

export function AuthLayout({
  children,
  className,
  noScroll = false,
}: AuthLayoutProps) {
  return (
    <div
      className={cn(
        "flex w-full bg-[#f6f6f7]",
        noScroll ? "h-svh max-h-svh overflow-hidden" : "min-h-svh",
      )}
    >
      {/* Form column */}
      <div
        className={cn(
          "relative flex w-full flex-col bg-white lg:w-[46%] xl:w-[44%]",
          noScroll && "min-h-0 overflow-hidden",
        )}
      >
        <div
          className={cn(
            "flex flex-1 flex-col",
            noScroll
              ? "min-h-0 px-5 py-4 sm:px-8 sm:py-5 lg:px-10"
              : "px-6 py-6 sm:px-10 sm:py-8 lg:px-12 xl:px-16",
          )}
        >
          <header className="shrink-0">
            <CubicleWordmark size={noScroll ? "sm" : "md"} />
          </header>

          <div
            className={cn(
              "mx-auto flex w-full flex-1 flex-col",
              noScroll
                ? "max-w-[360px] min-h-0 justify-center py-3"
                : "max-w-[380px] justify-center py-10 sm:py-14",
              className,
            )}
          >
            {children}
          </div>

          <footer className="shrink-0 pt-2">
            <p className="text-[11px] text-neutral-400">
              <Link
                href="/legal"
                className="transition-colors hover:text-neutral-600"
              >
                Legal
              </Link>
              <span className="mx-1.5 text-neutral-300">·</span>
              © {new Date().getFullYear()} Cubicle
            </p>
          </footer>
        </div>
      </div>

      {/* Brand panel — gradient + logo (same as onboarding) */}
      <div className="hidden p-3 pl-0 lg:block lg:w-[54%] xl:w-[56%]">
        <AuthBrandPanel fullHeight={noScroll} />
      </div>
    </div>
  );
}
