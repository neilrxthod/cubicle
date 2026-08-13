"use client";

import { useSearchParams } from "next/navigation";
import { TeacherLandscapeStage } from "@/components/app/teacher-mobile-landscape";
import { DailyBoard } from "@/components/daily-board";
import { getSchoolDate } from "@/lib/calendar/period-schedule";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { SessionUser } from "@/lib/types";

export function TeacherMobileSchedule({
  user,
  onBack,
}: {
  user: SessionUser;
  onBack: () => void;
}) {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? getSchoolDate();
  const state = usePlatformStore();

  return (
    <TeacherLandscapeStage title="Schedule" onBack={onBack}>
      <DailyBoard
        compact
        session={user}
        carts={state.carts}
        bookings={state.bookings}
        slotRestrictions={state.slotRestrictions}
        bookingPolicy={state.bookingPolicy}
        date={date}
      />
    </TeacherLandscapeStage>
  );
}
