"use client";

import { RouteLoading } from "@/components/app/route-loading";
import { ScheduleOpeningOverlay } from "@/components/onboarding/schedule-opening-overlay";

export default function Loading() {
  const firstRun =
    typeof window !== "undefined" &&
    window.location.pathname === "/" &&
    new URLSearchParams(window.location.search).has("firstRun");

  if (firstRun) return <ScheduleOpeningOverlay play={false} />;
  return <RouteLoading label="Loading Cubicle…" />;
}
