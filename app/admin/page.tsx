"use client";

import dynamic from "next/dynamic";
import { DashboardFrame } from "@/components/app/dashboard-frame";
import { PageShell } from "@/components/app/page-shell";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { SessionUser } from "@/lib/types";

const AdminConsole = dynamic(
  () =>
    import("@/components/admin-console").then((module) => ({
      default: module.AdminConsole,
    })),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    ),
  },
);

export default function AdminPage() {
  return (
    <RequirePlatformAuth role="admin">
      {(user) => <AdminHome user={user} />}
    </RequirePlatformAuth>
  );
}

function AdminHome({ user }: { user: SessionUser }) {
  const state = usePlatformStore();

  return (
    <DashboardFrame user={user}>
      <PageShell>
        <AdminConsole
          carts={state.carts}
          bookings={state.bookings}
          users={state.users}
          issues={state.issues}
          slotRestrictions={state.slotRestrictions}
          bookingPolicy={state.bookingPolicy}
          swapRequests={state.swapRequests}
        />
      </PageShell>
    </DashboardFrame>
  );
}
