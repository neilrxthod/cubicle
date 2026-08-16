"use client";

import { MobileReservations } from "@/components/app/mobile-reservations";
import type { SessionUser } from "@/lib/types";

export function TeacherMobileBookings({
  user,
  onBack,
}: {
  user: SessionUser;
  onBack: () => void;
}) {
  return <MobileReservations user={user} onBack={onBack} scope="mine" />;
}
