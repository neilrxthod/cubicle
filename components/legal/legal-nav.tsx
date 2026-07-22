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
    exact: false as const,
  })),
];

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
          : "flex flex-wrap items-center gap-x-1 gap-y-1",
      )}
    >
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md text-[13px] transition-colors",
              orientation === "vertical" ? "px-3 py-2" : "px-2.5 py-1.5",
              active
                ? "bg-neutral-100 font-medium text-neutral-950"
                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
