"use client";

import { format } from "date-fns";
import { DashboardFrame } from "@/components/app/dashboard-frame";
import { PageShell } from "@/components/app/page-shell";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { BookingsList } from "@/components/bookings-list";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { SessionUser } from "@/lib/types";

export default function MyBookingsPage() {
  return (
    <RequirePlatformAuth>
      {(user) => <MyBookings user={user} />}
    </RequirePlatformAuth>
  );
}

function MyBookings({ user }: { user: SessionUser }) {
  const state = usePlatformStore();
  const today = format(new Date(), "yyyy-MM-dd");
  const mine = state.bookings
    .filter((booking) => booking.teacherId === user.id)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.period.localeCompare(b.period),
    );
  const upcoming = mine.filter((booking) => booking.date >= today);
  const past = mine.filter((booking) => booking.date < today);

  return (
    <DashboardFrame user={user}>
      <PageShell
        title="Bookings"
        description="Your cart reservations by date and period."
      >
        <div className="flex flex-col gap-4">
          <BookingsList
            title="Upcoming"
            bookings={upcoming}
            carts={state.carts}
            emptyLabel="No upcoming bookings yet."
            emptyAction={{ href: "/", label: "Book a cart" }}
            canCancel
          />
          <BookingsList
            title="Past"
            bookings={past}
            carts={state.carts}
            emptyLabel="No past bookings yet."
          />
        </div>
      </PageShell>
    </DashboardFrame>
  );
}
