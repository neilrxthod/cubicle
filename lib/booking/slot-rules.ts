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

export type SlotLimitKind = "period" | "daily";

export type SlotLimitNotice = {
  kind: SlotLimitKind;
  title: string;
  body: string;
  meta: string;
};

export type SlotCheck =
  | { ok: true }
  | { ok: false; error: string; limit: SlotLimitNotice };

export function periodLimitNotice(
  used: number,
  max: number,
  who = "You",
): SlotLimitNotice {
  const isSelf = who === "You";
  return {
    kind: "period",
    title: "Period limit reached",
    body: isSelf
      ? `You can hold at most ${max} cart${max === 1 ? "" : "s"} in the same period. Cancel one of those bookings to free a slot.`
      : `${who} already holds ${max} cart${max === 1 ? "" : "s"} in this period.`,
    meta: `${used} of ${max} this period`,
  };
}

export function dailyLimitNotice(
  used: number,
  max: number,
  who = "You",
): SlotLimitNotice {
  const isSelf = who === "You";
  return {
    kind: "daily",
    title: "Daily limit reached",
    body: isSelf
      ? max === 1
        ? "You can book at most 1 cart slot per day. Cancel today’s booking to make room."
        : `You’ve used all ${max} cart slots allowed for this day. Cancel an existing booking to make room.`
      : `${who} is at their daily cart limit.`,
    meta: `${used} of ${max} today`,
  };
}

/** Recover a notice from an action error string (toasts are disabled). */
export function slotLimitNoticeFromError(
  error: string | undefined,
): SlotLimitNotice | null {
  if (!error) return null;
  const text = error.toLowerCase();
  if (
    text.includes("same period") ||
    text.includes("this period") ||
    text.includes("max carts this period")
  ) {
    return periodLimitNotice(
      MAX_CARTS_PER_PERIOD_TEACHER,
      MAX_CARTS_PER_PERIOD_TEACHER,
    );
  }
  if (text.includes("per day") || text.includes("daily cart limit")) {
    const match = error.match(/(\d+)/);
    const max = match ? Number(match[1]) : 5;
    return dailyLimitNotice(max, Number.isFinite(max) ? max : 5);
  }
  return null;
}

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
    const limit = periodLimitNotice(
      periodCount,
      MAX_CARTS_PER_PERIOD_TEACHER,
      who,
    );
    return {
      ok: false,
      limit,
      error: isSelf
        ? `You can book at most ${MAX_CARTS_PER_PERIOD_TEACHER} carts in the same period.`
        : `${who} already has ${MAX_CARTS_PER_PERIOD_TEACHER} carts this period.`,
    };
  }

  const dayCount = countUserDaySlots(bookings, userId, date);
  const dayMax = maxSlotsPerDay(policy);
  if (dayCount >= dayMax) {
    const limit = dailyLimitNotice(dayCount, dayMax, who);
    return {
      ok: false,
      limit,
      error: isSelf
        ? dayMax === 1
          ? "You can book at most 1 cart slot per day."
          : `You can book at most ${dayMax} cart slots per day.`
        : `${who} is at their daily cart limit.`,
    };
  }

  return { ok: true };
}

/** Board / table placeholder until a Class booking is given a real name. */
export const GENERIC_CLASS_LABEL = "N/A yet";

export function isGenericClassValue(
  value: string | undefined | null,
): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return !v || v === "class" || v === "n/a yet" || v === "n/a";
}

/** Visible class / subject — generic Class bookings stay unlabeled until set. */
export function bookingClassLabel(
  booking: Pick<Booking, "className" | "subject">,
): string {
  const custom = (booking.className ?? booking.subject ?? "").trim();
  if (isGenericClassValue(custom)) return GENERIC_CLASS_LABEL;
  return custom;
}

/**
 * Short label shown on the board cell (purpose badge or custom multi tag).
 */
export function bookingBoardTagText(
  booking: Pick<Booking, "className" | "subject" | "notes">,
  purposeTag: string | null | undefined,
): string | null {
  if (purposeTag) return purposeTag;

  const custom = bookingClassLabel(booking);
  if (custom.length <= 18) return custom;
  return custom.slice(0, 16);
}
