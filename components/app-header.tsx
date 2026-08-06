"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/actions";
import {
  isLocalPerspectiveSwitcherEnabled,
  switchLocalPerspective,
} from "@/lib/auth/local-demo";
import { isVerifiedStaff } from "@/lib/staff/employment";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CubicleWordmark } from "@/components/auth/wordmark";
import { VerifiedBadge } from "@/components/verified-badge";
import { APP_VERSION_LABEL } from "@/lib/app-version";

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0]?.slice(0, 2) ?? "U");
  return letters.toUpperCase();
}

function Avatar({
  user,
  size = "sm",
}: {
  user: SessionUser;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "size-7 text-[11px]" : "size-9 text-[12px]";
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        decoding="async"
        className={cn(
          dim,
          "shrink-0 rounded-full object-cover",
          // Keep downscale sharp on high-DPI screens
          "[image-rendering:auto]",
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        dim,
        "flex shrink-0 items-center justify-center rounded-full bg-neutral-900 font-semibold text-white",
      )}
    >
      {initials(user.name)}
    </span>
  );
}

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Tesla product nav: pure type, open tracking, no pill chrome.
 * Active = full black + hairline underline. Inactive = muted, hover reveals.
 */
function NavLink({
  href,
  label,
  active,
  className,
}: {
  href: string;
  label: string;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative inline-flex h-full items-center justify-center px-3",
        "text-[12px] font-normal tracking-[0.12em] uppercase",
        "transition-colors duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:ring-offset-2",
        active
          ? "text-neutral-950"
          : "text-neutral-400 hover:text-neutral-950",
        className,
      )}
    >
      <span className="relative">
        {label}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -bottom-1 left-0 right-0 h-px origin-center bg-neutral-950 transition-transform duration-300 ease-out",
            active
              ? "scale-x-100"
              : "scale-x-0 group-hover:scale-x-100 group-hover:bg-neutral-400",
          )}
        />
      </span>
    </Link>
  );
}

export function AppHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "admin";
  const perspectiveEnabled = isLocalPerspectiveSwitcherEnabled();
  const [switching, setSwitching] = useState(false);

  const navItems = useMemo(
    () =>
      [
        { href: "/", label: "Schedule" },
        { href: "/my-bookings", label: "Bookings" },
        { href: "/issues", label: "Issues" },
        { href: "/admin", label: "Admin", show: isAdmin },
      ].filter((item) => item.show !== false),
    [isAdmin],
  );

  function handleSignOut() {
    void signOutAction();
  }

  function handlePerspective(role: "admin" | "teacher") {
    if (!perspectiveEnabled || switching) return;
    if (user.role === role) {
      // Already this persona — still jump home for that role.
      router.push(role === "admin" ? "/admin" : "/");
      return;
    }
    setSwitching(true);
    const result = switchLocalPerspective(role);
    setSwitching(false);
    if (!result.ok) return;
    router.push(role === "admin" ? "/admin" : "/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-white/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-2xl">
      <div className="platform-shell relative flex h-14 w-full min-w-0 items-center justify-between sm:h-16">
        {/* Same left edge as main shell; bold mark + platform version */}
        <div className="relative z-10 flex h-full min-w-0 shrink items-center gap-1.5 sm:gap-2">
          <CubicleWordmark
            size="sm"
            href="/"
            className="mr-[-0.28em] shrink-0 font-bold text-[11px] leading-none tracking-[0.28em] sm:text-[12px]"
          />
          <span
            className="select-none rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums tracking-tight text-neutral-500"
            title="Platform version"
          >
            {APP_VERSION_LABEL}
          </span>
        </div>

        <nav
          aria-label="Primary"
          className="absolute left-1/2 top-0 hidden h-full max-w-[min(100%,42rem)] -translate-x-1/2 md:block"
        >
          <div className="flex h-full min-w-0 items-stretch gap-0.5 lg:gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActivePath(pathname, item.href)}
              />
            ))}
          </div>
        </nav>

        <div className="relative z-10 flex h-full shrink-0 items-center gap-2 sm:gap-2.5">
          {perspectiveEnabled ? (
            <div
              role="group"
              aria-label="Local perspective"
              className="flex h-8 items-center rounded-md border border-black/[0.08] bg-neutral-50 p-0.5"
            >
              {(
                [
                  { role: "teacher" as const, label: "Teacher" },
                  { role: "admin" as const, label: "Admin" },
                ] as const
              ).map((opt) => {
                const active = user.role === opt.role;
                return (
                  <button
                    key={opt.role}
                    type="button"
                    disabled={switching}
                    aria-pressed={active}
                    title={`View as ${opt.label} (local only)`}
                    onClick={() => handlePerspective(opt.role)}
                    className={cn(
                      "inline-flex h-7 items-center rounded-[5px] px-2 sm:px-2.5",
                      "text-[11px] font-medium tracking-[-0.01em] transition-colors",
                      active
                        ? "bg-white text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        : "text-neutral-500 hover:text-neutral-800",
                      "disabled:pointer-events-none disabled:opacity-50",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/15",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 max-w-[min(11rem,40vw)] items-center gap-2 rounded-full border border-transparent bg-transparent py-0.5 pl-0.5 pr-2 text-left transition-colors duration-200 hover:border-neutral-200/80 hover:bg-neutral-50/90"
              >
                <Avatar user={user} size="sm" />
                <span className="hidden min-w-0 flex-col leading-tight sm:flex">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <span className="truncate text-[12px] font-medium tracking-[-0.01em] text-neutral-950">
                      {user.firstName || user.name.split(" ")[0]}
                    </span>
                    {isVerifiedStaff(user) ? (
                      <VerifiedBadge size="xs" />
                    ) : null}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
              <DropdownMenuLabel className="px-2 py-2 font-normal">
                <div className="flex items-center gap-2.5">
                  <Avatar user={user} size="md" />
                  <div className="min-w-0">
                    <p className="inline-flex min-w-0 items-center gap-1 text-[13px] font-semibold text-neutral-950">
                      <span className="truncate">{user.name}</span>
                      {isVerifiedStaff(user) ? (
                        <VerifiedBadge size="sm" />
                      ) : null}
                    </p>
                    <p className="truncate text-[12px] text-neutral-500">
                      {user.email}
                    </p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2 rounded-lg text-[13px]"
                onClick={() => router.push("/settings")}
              >
                <Settings className="size-4" strokeWidth={1.5} />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 rounded-lg text-[13px]"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" strokeWidth={1.5} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <nav
        aria-label="Primary"
        className="border-t border-[var(--hairline)] md:hidden"
      >
        <div className="flex h-11 items-stretch px-1">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 items-center justify-center",
                  "text-[10.5px] font-medium tracking-[0.1em] uppercase",
                  "transition-colors duration-200 ease-out",
                  active
                    ? "text-neutral-950"
                    : "text-neutral-400 active:text-neutral-700",
                )}
              >
                <span className="truncate px-1">{item.label}</span>
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-x-3 bottom-0 h-px bg-neutral-950 transition-opacity duration-200",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
