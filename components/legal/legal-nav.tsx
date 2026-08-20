"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEGAL_LINKS } from "@/lib/legal/constants";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: "/legal", label: "Overview", exact: true },
  ...LEGAL_LINKS.map((link) => ({
    href: link.href,
    label: link.label,
    exact: false as const,
  })),
];

/**
 * Tesla legal nav — pure type, open tracking.
 * Active = near-black + hairline underline (vertical: left rule).
 */
export function LegalNav({
  orientation = "horizontal",
}: {
  orientation?: "horizontal" | "vertical";
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Legal"
      className={cn(
        orientation === "vertical"
          ? "flex flex-col gap-0.5"
          : "flex flex-wrap items-center gap-x-0.5 gap-y-1",
      )}
    >
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        if (orientation === "vertical") {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative px-3 py-2 text-[11px] font-medium uppercase leading-snug tracking-[0.1em] transition-colors duration-200",
                active
                  ? "text-neutral-950"
                  : "text-neutral-400 hover:text-neutral-950",
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-y-2 left-0 w-px bg-neutral-950"
                />
              ) : null}
              {item.label}
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative inline-flex items-center px-2.5 py-1.5",
              "text-[11px] font-medium uppercase tracking-[0.12em]",
              "transition-colors duration-200",
              active
                ? "text-neutral-950"
                : "text-neutral-400 hover:text-neutral-950",
            )}
          >
            <span className="relative">
              {item.label}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -bottom-0.5 left-0 right-0 h-px origin-center bg-neutral-950 transition-transform duration-300 ease-out",
                  active
                    ? "scale-x-100"
                    : "scale-x-0 group-hover:scale-x-100 group-hover:bg-neutral-400",
                )}
              />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
