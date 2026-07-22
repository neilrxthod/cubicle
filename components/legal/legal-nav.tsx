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
    label: link.shortLabel,
  })),
];

export function LegalNav({
  orientation = "horizontal",
}: {
  orientation?: "horizontal" | "vertical";
}) {
  const pathname = usePathname();

  if (orientation === "horizontal") {
    return (
      <nav
        aria-label="Legal"
        className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-neutral-950 font-medium text-white"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Legal" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center rounded-lg px-3 py-2 text-[13.5px] transition-colors",
              active
                ? "bg-neutral-950 font-medium text-white"
                : "text-neutral-500 hover:bg-neutral-100/80 hover:text-neutral-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
