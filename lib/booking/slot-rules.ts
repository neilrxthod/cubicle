/**
 * Cart slot occupancy rules.
 *
 * Teachers: up to MAX_CARTS_PER_PERIOD_TEACHER carts in the same period
 * (and the usual daily cap). Admins: unlimited.
 */

import type { Booking, BookingPolicy, Period } from "@/lib/types";
import { bookingOccupiesUser } from "@/lib/types";

/** Max carts a teacher may hold in one period (same period multi-book). */
export const MAX_CARTS_PER_PERIOD_TEACHER = 2;

/** Default multi-book tag for admin quick-clicks. */
export const DEFAULT_ADMIN_MULTI_TAG = "Multi";

export function maxSlotsPerDay(policy: BookingPolicy): number {
  return Math.min(15, Math.max(1, policy.maxSlotsPerTeacherPerDay ?? 5));
}

export function countUserPeriodSlots(
  bookings: Booking[],
  userId: string,
  date: string,
  period: Period,
  excludeBookingIds: string[] = [],
): number {
  const day = date.slice(0, 10);
  const exclude = new Set(excludeBookingIds);
  return bookings.filter(
    (b) =>
      !exclude.has(b.id) &&
      b.date.slice(0, 10) === day &&
      b.period === period &&
      bookingOccupiesUser(b, userId),
  ).length;
}

export function countUserDaySlots(
  bookings: Booking[],
  userId: string,
  date: string,
  excludeBookingIds: string[] = [],
): number {
  const day = date.slice(0, 10);
  const exclude = new Set(excludeBookingIds);
  return bookings.filter(
    (b) =>
      !exclude.has(b.id) &&
      b.date.slice(0, 10) === day &&
      bookingOccupiesUser(b, userId),
  ).length;
}

export type SlotCheck =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Whether a teacher may take another cart on this date/period.
 * Admins should skip this check.
 */
export function canTeacherBookSlot(input: {
  bookings: Booking[];
  policy: BookingPolicy;
  userId: string;
  userLabel?: string;
  date: string;
  period: Period;
}): SlotCheck {
  const { bookings, policy, userId, date, period } = input;
  const who = input.userLabel?.trim() || "You";
  const isSelf = who === "You";

  const periodCount = countUserPeriodSlots(bookings, userId, date, period);
  if (periodCount >= MAX_CARTS_PER_PERIOD_TEACHER) {
    return {
      ok: false,
      error: isSelf
        ? `You can book at most ${MAX_CARTS_PER_PERIOD_TEACHER} carts in the same period.`
        : `${who} already has ${MAX_CARTS_PER_PERIOD_TEACHER} carts this period.`,
    };
  }

  const dayCount = countUserDaySlots(bookings, userId, date);
  const dayMax = maxSlotsPerDay(policy);
  if (dayCount >= dayMax) {
    return {
      ok: false,
      error: isSelf
        ? dayMax === 1
          ? "You can book at most 1 cart slot per day."
          : `You can book at most ${dayMax} cart slots per day.`
        : `${who} is at their daily cart limit.`,
    };
  }

  return { ok: true };
}

/**
 * Short label shown on the board cell (purpose badge or custom multi tag).
 */
export function bookingBoardTagText(
  booking: Pick<Booking, "className" | "subject" | "notes">,
  purposeTag: string | null | undefined,
): string | null {
  if (purposeTag) return purposeTag;

  const custom = (booking.className ?? booking.subject ?? "").trim();
  if (!custom) return null;
  // Skip generic "Class" storage
  if (custom.toLowerCase() === "class") return null;
  // Short custom labels (multi-book renames)
  if (custom.length <= 18) return custom;
  return custom.slice(0, 16);
}
