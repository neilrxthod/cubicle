"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { addDays, format, parseISO, subDays } from "date-fns";
import { DashboardFrame } from "@/components/app/dashboard-frame";
import { PageShell } from "@/components/app/page-shell";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { DailyBoard } from "@/components/daily-board";
import {
  StatsDisplay,
  type StatItem,
} from "@/components/tool-ui/stats-display";
import { ShareInvitesList } from "@/components/share-invites-list";
import { SwapRequestsList } from "@/components/swap-requests-list";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { Booking, Issue, SessionUser } from "@/lib/types";

const SPARK_DAYS = 14;

export default function HomePage() {
  return (
    <RequirePlatformAuth>
      {(user) => (
        <Suspense
          fallback={
            <div className="flex h-svh items-center justify-center bg-[var(--canvas,#f4f4f5)]">
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

function dayKeysEnding(endDate: string, days: number): string[] {
  const end = parseISO(endDate);
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(format(subDays(end, i), "yyyy-MM-dd"));
  }
  return keys;
}

/** Bookings counted per calendar day (ends on selected board date). */
function bookingCountsByDay(
  bookings: Booking[],
  endDate: string,
  days: number,
  filter?: (b: Booking) => boolean,
): number[] {
  const keys = dayKeysEnding(endDate, days);
  const list = filter ? bookings.filter(filter) : bookings;
  return keys.map((key) => list.filter((b) => b.date === key).length);
}

/**
 * Open-issue load per day from real issue timestamps.
 * Open issues count from creation → selected end date.
 * Resolved issues count for ~2 days after creation (demo resolution lag).
 */
function openIssueLoadByDay(
  issues: Issue[],
  endDate: string,
  days: number,
): number[] {
  const keys = dayKeysEnding(endDate, days);
  return keys.map((key) => {
    let open = 0;
    for (const issue of issues) {
      const created = format(parseISO(issue.createdAt), "yyyy-MM-dd");
      if (created > key) continue;
      if (issue.status === "open") {
        open += 1;
        continue;
      }
      const resolvedBy = format(addDays(parseISO(issue.createdAt), 2), "yyyy-MM-dd");
      if (key <= resolvedBy) open += 1;
    }
    return open;
  });
}

/**
 * Day-over-day % only when the prior day has a real baseline.
 */
function dayOverDayDiff(
  current: number,
  previous: number,
  opts?: { upIsPositive?: boolean; decimals?: number },
): StatItem["diff"] {
  if (previous <= 0) return undefined;
  const raw = ((current - previous) / previous) * 100;
  const value = Math.round(Math.max(-999, Math.min(999, raw)) * 10) / 10;
  return {
    value,
    decimals: opts?.decimals ?? 1,
    upIsPositive: opts?.upIsPositive,
  };
}

function HomeBoard({ user }: { user: SessionUser }) {
  const state = usePlatformStore();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");

  const stats = useMemo((): StatItem[] => {
    const todayBookings = state.bookings.filter((b) => b.date === date);
    const mine = todayBookings.filter(
      (b) => b.teacherId === user.id || b.sharedWithId === user.id,
    );
    const activeCarts = state.carts.filter((c) => c.status === "active").length;
    const openIssues = state.issues.filter((i) => i.status === "open").length;
    const capacity = Math.max(activeCarts * 5, 1);
    const freeSlots = Math.max(capacity - todayBookings.length, 0);
    const utilization =
      Math.round((todayBookings.length / capacity) * 1000) / 10;

    const yesterdayKey = format(subDays(parseISO(date), 1), "yyyy-MM-dd");
    const yBooked = state.bookings.filter((b) => b.date === yesterdayKey).length;
    const yMine = state.bookings.filter(
      (b) =>
        b.date === yesterdayKey &&
        (b.teacherId === user.id || b.sharedWithId === user.id),
    ).length;
    const yFree = Math.max(activeCarts * 5 - yBooked, 0);
    const yUtil = Math.round((yBooked / capacity) * 1000) / 10;

    // ——— Multi-day series from live platform store ———
    const bookedSpark = bookingCountsByDay(
      state.bookings,
      date,
      SPARK_DAYS,
    );
    const mineSpark = bookingCountsByDay(
      state.bookings,
      date,
      SPARK_DAYS,
      (b) => b.teacherId === user.id || b.sharedWithId === user.id,
    );
    const freeSpark = bookedSpark.map((n) =>
      Math.max(activeCarts * 5 - n, 0),
    );
    const utilSpark = bookedSpark.map(
      (n) => Math.round((n / capacity) * 1000) / 10,
    );
    const issueSpark = openIssueLoadByDay(
      state.issues,
      date,
      SPARK_DAYS,
    );

    // Previous-day open issues for honest DoD when series has signal
    const yIssues =
      issueSpark.length >= 2
        ? issueSpark[issueSpark.length - 2]!
        : 0;

    // Monochrome sparks — Tesla product, not multi-color analytics.
    const spark = "rgb(23 23 23)";

    return [
      {
        key: "booked",
        label: "Booked",
        value: todayBookings.length,
        format: { kind: "number" },
        sparkline: { data: bookedSpark, color: spark },
        diff: dayOverDayDiff(todayBookings.length, yBooked),
      },
      {
        key: "utilization",
        label: "Utilization",
        value: utilization,
        format: { kind: "percent", decimals: 1, basis: "unit" },
        sparkline: { data: utilSpark, color: spark },
        diff: dayOverDayDiff(utilization, yUtil),
      },
      {
        key: "yours",
        label: "Yours",
        value: mine.length,
        format: { kind: "number" },
        sparkline: { data: mineSpark, color: spark },
        diff: dayOverDayDiff(mine.length, yMine),
      },
      {
        key: "issues",
        label: "Issues",
        value: openIssues,
        format: { kind: "number" },
        sparkline: { data: issueSpark, color: spark },
        diff: dayOverDayDiff(openIssues, yIssues, {
          upIsPositive: false,
        }),
      },
      {
        key: "free",
        label: "Free",
        value: freeSlots,
        format: { kind: "number" },
        sparkline: { data: freeSpark, color: spark },
        diff: dayOverDayDiff(freeSlots, yFree),
      },
    ];
  }, [state, date, user.id]);

  const incomingSwaps = state.swapRequests.filter((request) => {
    if (request.status !== "pending") return false;
    const booking = state.bookings.find(
      (entry) => entry.id === request.bookingId,
    );
    return booking?.teacherId === user.id;
  });

  const outgoingSwaps = state.swapRequests.filter(
    (request) =>
      request.status === "pending" && request.requesterId === user.id,
  );

  return (
    <DashboardFrame user={user}>
      <PageShell>
        <div className="flex flex-col gap-4 sm:gap-5">
          <StatsDisplay
            id="schedule-stats"
            className="w-full max-w-none"
            stats={stats}
          />
          <ShareInvitesList
            bookings={state.bookings}
            carts={state.carts}
            userId={user.id}
          />
          <SwapRequestsList
            requests={incomingSwaps}
            bookings={state.bookings}
            carts={state.carts}
            variant="incoming"
          />
          <SwapRequestsList
            requests={outgoingSwaps}
            bookings={state.bookings}
            carts={state.carts}
            variant="outgoing"
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
