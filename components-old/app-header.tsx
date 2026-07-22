"use client"

import { useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, LogOut, UserRound } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOutAction } from "@/lib/actions"
import type { SessionUser } from "@/lib/types"
import { cn } from "@/lib/utils"

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "U"
  return letters.toUpperCase()
}

export function AppHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname()
  const isAdmin = user.role === "admin"


  const navItems = useMemo(() => [
    { href: "/", label: "Home" },
    { href: "/my-bookings", label: "Bookings" },
    { href: "/issues", label: "Issues" },
    { href: "/admin", label: "Maintenance", show: isAdmin },
  ].filter(item => item.show !== false), [isAdmin])

  return (
    <header className="border-b border-border/70 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto relative flex h-20 w-full max-w-300 items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <span className="text-[1.18rem] font-semibold tracking-[-0.03em] text-foreground">Air Kart</span>
        </Link>

        <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center md:flex">
          <div className="relative inline-flex items-center gap-1 rounded-full border border-black bg-black p-1">
            {navItems.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors duration-300",
                      active
                        ? "bg-white text-black"
                        : "text-white/75 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
          </div>
        </nav>

        <div className="flex items-center gap-2.5">
          {isAdmin && (
            <button
              type="button"
              aria-label="Notifications"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-white text-muted-foreground transition-colors hover:text-foreground"
            >
              <Bell className="size-4.5" strokeWidth={1.5} />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-3 rounded-full border border-border/80 bg-white px-1.5 py-1.5 pr-3 text-left transition-colors hover:border-foreground/20"
              >
                <span className="flex size-8.5 items-center justify-center rounded-full border border-border bg-white text-xs font-semibold text-foreground">
                  {initials(user.name)}
                </span>
                <span className="hidden flex-col leading-tight sm:flex">
                  <span className="text-[13px] font-semibold text-foreground">{user.name}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{user.role}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Account
              </DropdownMenuLabel>
              <DropdownMenuItem className="gap-2 text-sm" disabled>
                <UserRound className="h-4 w-4" strokeWidth={1.5} />
                {user.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.5} />
                  Sign out
                </button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
