"use client";

import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/toaster";
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
      <Toaster />
    </div>
  );
}
