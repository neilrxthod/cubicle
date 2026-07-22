"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/toaster";
import { LEGAL_LINKS } from "@/lib/legal/constants";
import type { SessionUser } from "@/lib/types";

/**
 * Corporate app chrome — white header, soft canvas, consistent content width.
 */
export function DashboardFrame({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-[#f6f6f7] text-neutral-950">
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-300 flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-neutral-200/80 bg-white/70">
        <div className="mx-auto flex w-full max-w-300 flex-col gap-2 px-4 py-4 text-[11.5px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Cubicle · Authorized school staff only</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-neutral-700"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}
