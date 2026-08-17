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

      {/* Centered logo — negative margin cancels trailing letter-spacing so optical center is true */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-8 text-center">
        <CubicleWordmark
          size="hero"
          href={null}
          tone="light"
          className="font-extralight tracking-[0.52em] text-white/92 drop-shadow-[0_1px_24px_rgba(255,255,255,0.12)] mr-[-0.52em] text-center"
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
        "flex w-full min-w-0 bg-[#f6f6f7]",
        noScroll
          ? "h-dvh max-h-dvh overflow-hidden"
          : "min-h-dvh",
      )}
    >
      {/* Form column */}
      <div
        className={cn(
          "relative flex w-full min-w-0 flex-col bg-white lg:w-[46%] xl:w-[42%]",
          noScroll && "min-h-0 overflow-hidden",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            "pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))]",
            "pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
            noScroll
              ? "min-h-0 sm:px-8 sm:py-5 lg:px-10"
              : "sm:px-10 sm:py-8 lg:px-12 xl:px-16",
          )}
        >
          <header className="shrink-0">
            <CubicleWordmark
              size={noScroll ? "sm" : "md"}
              className="font-bold"
            />
          </header>

          <div
            className={cn(
              "mx-auto flex w-full min-w-0 flex-1 flex-col",
              noScroll
                ? "max-w-[min(100%,22.5rem)] min-h-0 justify-center py-3"
                : "max-w-[min(100%,23.75rem)] justify-center py-8 sm:py-14",
              className,
            )}
          >
            {children}
          </div>

          <footer className="shrink-0 pt-2">
            <p className="text-[11px] text-neutral-400">
              <Link
                href="/about"
                className="transition-colors hover:text-neutral-600"
              >
                About
              </Link>
              <span className="mx-1.5 text-neutral-300">·</span>
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
      <div className="hidden min-w-0 flex-1 p-3 pl-0 lg:block">
        <AuthBrandPanel fullHeight={noScroll} />
      </div>
    </div>
  );
}
