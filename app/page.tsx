"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { DashboardFrame } from "@/components/app/dashboard-frame";
import { PageShell } from "@/components/app/page-shell";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { DailyBoard } from "@/components/daily-board";
import { StatBar } from "@/components/stat-bar";
import { SwapRequestsList } from "@/components/swap-requests-list";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { SessionUser } from "@/lib/types";

export default function HomePage() {
  return (
    <RequirePlatformAuth>
      {(user) => (
        <Suspense
          fallback={
            <div className="flex h-svh items-center justify-center bg-[#f6f6f7]">
              <div className="size-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
            </div>
          }
        >
          <HomeBoard user={user} />
        </Suspense>
      )}
    </RequirePlatformAuth>
  );
}

function HomeBoard({ user }: { user: SessionUser }) {
  const state = usePlatformStore();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");

  const stats = useMemo(() => {
    const todayBookings = state.bookings.filter(
      (booking) => booking.date === date,
    );
    const mine = todayBookings.filter(
      (booking) => booking.teacherId === user.id,
    );
    const activeCarts = state.carts.filter(
      (cart) => cart.status === "active",
    ).length;
    const openIssues = state.issues.filter(
      (issue) => issue.status === "open",
    ).length;
    const freeSlots = activeCarts * 5 - todayBookings.length;

    return [
      { label: "Active carts", value: activeCarts },
      { label: "Bookings", value: todayBookings.length },
      { label: "Yours", value: mine.length },
      { label: "Issues", value: openIssues },
      { label: "Free slots", value: Math.max(freeSlots, 0) },
    ];
  }, [state, date, user.id]);

  const incomingSwaps = state.swapRequests.filter((request) => {
    if (request.status !== "pending") return false;
    const booking = state.bookings.find(
      (entry) => entry.id === request.bookingId,
    );
    return booking?.teacherId === user.id;
  });

  return (
    <DashboardFrame user={user}>
      <PageShell
        title="Home"
        description="Live cart availability by period."
      >
        <div className="flex flex-col gap-4 sm:gap-5">
          <StatBar stats={stats} />
          <SwapRequestsList
            requests={incomingSwaps}
            bookings={state.bookings}
            carts={state.carts}
          />
          <DailyBoard
            session={user}
            carts={state.carts}
            bookings={state.bookings}
            slotRestrictions={state.slotRestrictions}
            bookingPolicy={state.bookingPolicy}
            date={date}
          />
        </div>
      </PageShell>
    </DashboardFrame>
  );
}
