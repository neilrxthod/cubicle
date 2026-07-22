"use client";

import { DashboardFrame } from "@/components/app/dashboard-frame";
import { PageShell } from "@/components/app/page-shell";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { AdminConsole } from "@/components/admin-console";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { SessionUser } from "@/lib/types";

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
      <PageShell
        title="Maintenance"
        description="Inventory, reservations, reports, credentials, and restrictions."
      >
        <AdminConsole
          carts={state.carts}
          bookings={state.bookings}
          users={state.users}
          issues={state.issues}
          slotRestrictions={state.slotRestrictions}
          bookingPolicy={state.bookingPolicy}
        />
      </PageShell>
    </DashboardFrame>
  );
}
