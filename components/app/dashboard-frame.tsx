"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/toaster";
import {
  isLocalDemoMode,
  LOCAL_SANDBOX_BANNER,
} from "@/lib/data/durability";
import { LEGAL_LINKS } from "@/lib/legal/constants";
import type { SessionUser } from "@/lib/types";

/**
 * Post-auth product chrome — fluid shell that flexes phone → ultrawide.
 */
export function DashboardFrame({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const localSandbox = isLocalDemoMode();

  return (
    <div className="flex min-h-dvh w-full min-w-0 flex-col bg-[var(--canvas)] text-neutral-950">
      <AppHeader user={user} />
      {localSandbox ? (
        <div
          role="status"
          className="border-b border-black/[0.06] bg-neutral-50 px-4 py-2 text-center text-[12px] leading-snug text-neutral-600 sm:text-[12.5px]"
        >
          {LOCAL_SANDBOX_BANNER} Use the Teacher / Admin control in the header to
          switch perspectives.
        </div>
      ) : null}
      <main className="platform-shell min-w-0 flex-1 py-[var(--shell-py)] pb-[max(var(--shell-py),env(safe-area-inset-bottom,0px))]">
        <div className="min-w-0 w-full">{children}</div>
      </main>
      {/* Tesla footer — pure type, open tracking, whisper hairline */}
      <footer className="border-t border-[var(--hairline)] bg-transparent pb-[env(safe-area-inset-bottom,0px)]">
        <div className="platform-shell flex flex-col items-center justify-between gap-3 py-4 sm:flex-row sm:gap-6 sm:py-5">
          <p className="shrink-0 text-[10.5px] font-normal uppercase tracking-[0.16em] text-neutral-400">
            <span className="text-neutral-300">©</span>{" "}
            {new Date().getFullYear()}{" "}
            <span className="tracking-[0.2em] text-neutral-500">Cubicle</span>
          </p>
          <nav
            aria-label="Legal"
            className="flex min-w-0 flex-wrap items-center justify-center gap-x-0 sm:justify-end"
          >
            {LEGAL_LINKS.map((link, index) => (
              <span key={link.href} className="inline-flex items-center">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className="mx-2.5 h-2.5 w-px bg-neutral-200 sm:mx-3"
                  />
                ) : null}
                <Link
                  href={link.href}
                  className="text-[10.5px] font-normal uppercase tracking-[0.14em] text-neutral-400 transition-colors duration-200 hover:text-neutral-950"
                >
                  {link.shortLabel}
                </Link>
              </span>
            ))}
          </nav>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}
