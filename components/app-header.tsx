"use client";

import { useMemo } from "react";
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
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

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
        className={cn(dim, "shrink-0 rounded-full object-cover")}
      />
    );
  }
  return (
    <span
      className={cn(
        dim,
        "flex shrink-0 items-center justify-center rounded-full bg-neutral-950 font-semibold text-white",
      )}
    >
      {initials(user.name)}
    </span>
  );
}

export function AppHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "admin";

  const navItems = useMemo(
    () =>
      [
        { href: "/", label: "Home" },
        { href: "/my-bookings", label: "Bookings" },
        { href: "/issues", label: "Issues" },
        { href: "/admin", label: "Maintenance", show: isAdmin },
      ].filter((item) => item.show !== false),
    [isAdmin],
  );

  function handleSignOut() {
    void signOutAction();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md">
      <div className="relative mx-auto flex h-14 w-full max-w-300 items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link href="/" className="shrink-0">
          <span className="text-[1.0625rem] font-semibold tracking-[-0.03em] text-neutral-950">
            Cubicle
          </span>
        </Link>

        <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <div className="inline-flex h-9 items-center gap-0.5 rounded-full bg-neutral-100 p-0.5">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-8 min-w-[5.5rem] items-center justify-center rounded-full px-3 text-[13px] font-medium transition-colors lg:min-w-[6.25rem]",
                    active
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 max-w-[12rem] items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 pl-1 pr-2.5 text-left transition-colors hover:border-neutral-300"
              >
                <Avatar user={user} size="sm" />
                <span className="hidden min-w-0 flex-col leading-tight sm:flex">
                  <span className="truncate text-[12.5px] font-medium text-neutral-950">
                    {user.name}
                  </span>
                  <span className="text-[10px] font-medium capitalize text-neutral-400">
                    {user.role}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
              <DropdownMenuLabel className="px-2 py-2 font-normal">
                <div className="flex items-center gap-2.5">
                  <Avatar user={user} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-neutral-950">
                      {user.name}
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
              <DropdownMenuSeparator />
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

      <div className="border-t border-neutral-100 px-3 py-2 md:hidden">
        <div className="flex gap-1">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-8 min-w-0 flex-1 items-center justify-center rounded-full px-2 text-[11px] font-medium",
                  active
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-500",
                )}
              >
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
