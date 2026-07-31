"use client";

import { Suspense } from "react";
import { DashboardFrame } from "@/components/app/dashboard-frame";
import { PageShell } from "@/components/app/page-shell";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { AdminConsole } from "@/components/admin-console";
import { FirstRunCoach } from "@/components/onboarding/first-run-coach";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { SessionUser } from "@/lib/types";

export default function AdminPage() {
  return (
    <RequirePlatformAuth role="admin">
      {(user) => (
        <Suspense
          fallback={
            <div className="flex h-svh items-center justify-center bg-[var(--canvas,#f4f4f5)]">
              <div className="size-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
            </div>
          }
        >
          <AdminHome user={user} />
        </Suspense>
      )}
    </RequirePlatformAuth>
  );
}

function AdminHome({ user }: { user: SessionUser }) {
  const state = usePlatformStore();

  return (
    <DashboardFrame user={user}>
      <PageShell title="Admin" description="Carts, staff, and locks.">
        <div className="flex flex-col gap-5">
          <FirstRunCoach user={user} />
          <AdminConsole
            carts={state.carts}
            bookings={state.bookings}
            users={state.users}
            issues={state.issues}
            slotRestrictions={state.slotRestrictions}
            bookingPolicy={state.bookingPolicy}
            swapRequests={state.swapRequests}
          />
        </div>
      </PageShell>
    </DashboardFrame>
  );
}
