"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/toaster";
import { LEGAL_LINKS } from "@/lib/legal/constants";
import type { SessionUser } from "@/lib/types";

/**
 * Post-auth product chrome — quiet canvas, one content width, minimal footer.
 */
export function DashboardFrame({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-[var(--canvas)] text-neutral-950">
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-300 flex-1 px-4 py-5 sm:px-6 sm:py-7">
        {children}
      </main>
      <footer className="border-t border-[var(--hairline)] bg-white/60">
        <div className="mx-auto flex w-full max-w-300 items-center justify-between gap-3 px-4 py-3 text-[11px] text-neutral-400 sm:px-6">
          <p className="shrink-0">© {new Date().getFullYear()} Cubicle</p>
          <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-neutral-700"
              >
                {link.shortLabel}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}
