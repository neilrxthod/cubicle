import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AUTH_IMAGE } from "@/lib/auth/constants";
import { LEGAL_LINKS } from "@/lib/legal/constants";
import { CubicleWordmark } from "./wordmark";

type AuthLayoutProps = {
  children: React.ReactNode;
  className?: string;
  /** Lock to viewport and hide page scroll (used by dense forms like signup). */
  noScroll?: boolean;
};

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

          <footer className="shrink-0 border-t border-black/[0.05] pt-4">
            <nav
              aria-label="Legal"
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-neutral-400"
            >
              {LEGAL_LINKS.map((link, i) => (
                <span key={link.href} className="inline-flex items-center gap-2.5">
                  {i > 0 ? (
                    <span aria-hidden className="text-neutral-300">
                      ·
                    </span>
                  ) : null}
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-neutral-700"
                  >
                    {link.shortLabel}
                  </Link>
                </span>
              ))}
            </nav>
            <p className="mt-2 text-[11px] text-neutral-400">
              © {new Date().getFullYear()} Cubicle
            </p>
          </footer>
        </div>
      </div>

      {/* Brand panel */}
      <div className="hidden p-3 pl-0 lg:block lg:w-[54%] xl:w-[56%]">
        <aside
          className={cn(
            "relative overflow-hidden rounded-2xl bg-neutral-200",
            noScroll ? "h-full" : "h-full min-h-[calc(100svh-1.5rem)]",
          )}
        >
          <Image
            src={AUTH_IMAGE}
            alt=""
            fill
            priority
            className="object-cover object-center"
            sizes="(min-width: 1024px) 56vw, 0px"
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,transparent_35%,rgba(0,0,0,0.45)_100%)]"
          />

          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/15 to-transparent"
          />
        </aside>
      </div>
    </div>
  );
}
