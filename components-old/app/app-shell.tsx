"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth/types";
import { useLogout } from "@/components/auth/require-auth";
import { CubicleWordmark } from "@/components/auth/wordmark";
import { countOpenIssues, useCubicleStore } from "@/lib/cubicle/store";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  badge?: number;
};

export function AppShell({
  user,
  nav,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const logout = useLogout();
  const state = useCubicleStore();
  const openIssues = countOpenIssues(state);

  const items = nav.map((item) =>
    item.href.includes("issues")
      ? { ...item, badge: openIssues > 0 ? openIssues : undefined }
      : item,
  );

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-4 px-5 sm:px-6">
          <div className="flex items-center gap-8">
            <CubicleWordmark
              size="md"
              href={user.role === "admin" ? "/admin" : "/teacher"}
            />
            <nav className="hidden items-center gap-1 md:flex">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/teacher" &&
                    item.href !== "/admin" &&
                    pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium tracking-[-0.01em] transition-colors",
                      active
                        ? "bg-neutral-100 text-neutral-950"
                        : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
                    )}
                  >
                    {item.label}
                    {item.badge ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
                {user.name}
              </p>
              <p className="text-[11.5px] capitalize text-neutral-400">
                {user.role}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="h-9 rounded-lg px-3 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="border-t border-black/[0.04] px-3 py-2 md:hidden">
          <nav className="flex gap-1 overflow-x-auto">
            {items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/teacher" &&
                  item.href !== "/admin" &&
                  pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium",
                    active
                      ? "bg-neutral-100 text-neutral-950"
                      : "text-neutral-500",
                  )}
                >
                  {item.label}
                  {item.badge ? (
                    <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-5 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}

export const teacherNav = [
  { href: "/teacher", label: "Today" },
  { href: "/teacher/book", label: "Book" },
  { href: "/teacher/bookings", label: "My bookings" },
  { href: "/teacher/issues", label: "Issues" },
];

export const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/carts", label: "Carts" },
  { href: "/admin/issues", label: "Issues" },
];
