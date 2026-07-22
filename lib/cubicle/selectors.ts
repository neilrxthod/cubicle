import { formatPeriod, getPeriod } from "./periods";
import {
  getActiveBookings,
  getBookingForSlot,
  getCart,
  isCartBookable,
} from "./store";
import type {
  Booking,
  Cart,
  CubicleState,
  Issue,
  PeriodId,
} from "./types";

export type SlotStatus = "available" | "booked" | "unavailable";

export type CartDayView = {
  cart: Cart;
  periods: Array<{
    periodId: PeriodId;
    status: SlotStatus;
    booking?: Booking;
  }>;
};

export function getCartDayView(
  state: CubicleState,
  date: string,
): CartDayView[] {
  return state.carts.map((cart) => ({
    cart,
    periods: ([1, 2, 3, 4, 5, 6, 7, 8] as PeriodId[]).map((periodId) => {
      if (!isCartBookable(cart)) {
        return { periodId, status: "unavailable" as const };
      }
      const booking = getBookingForSlot(state, cart.id, date, periodId);
      if (booking) {
        return { periodId, status: "booked" as const, booking };
      }
      return { periodId, status: "available" as const };
    }),
  }));
}

export function getTeacherBookings(
  state: CubicleState,
  email: string,
): Booking[] {
  return getActiveBookings(state)
    .filter(
      (booking) => booking.teacherEmail.toLowerCase() === email.toLowerCase(),
    )
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.periodId - b.periodId;
    });
}

export function getBookingsForDate(
  state: CubicleState,
  date: string,
): Booking[] {
  return getActiveBookings(state)
    .filter((booking) => booking.date === date)
    .sort((a, b) => a.periodId - b.periodId || a.cartId.localeCompare(b.cartId));
}

export function getOpenIssues(state: CubicleState): Issue[] {
  return state.issues
    .filter((issue) => issue.status !== "resolved")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function getAvailableCartCount(
  state: CubicleState,
  date: string,
  periodId: PeriodId,
): number {
  return state.carts.filter((cart) => {
    if (!isCartBookable(cart)) return false;
    return !getBookingForSlot(state, cart.id, date, periodId);
  }).length;
}

export function enrichBooking(state: CubicleState, booking: Booking) {
  const cart = getCart(state, booking.cartId);
  const period = getPeriod(booking.periodId);
  return {
    booking,
    cart,
    period,
    periodLabel: formatPeriod(booking.periodId),
  };
}

export function cartStatusLabel(status: Cart["status"]): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "maintenance":
      return "Maintenance";
    case "offline":
      return "Offline";
  }
}

export function issueStatusLabel(status: Issue["status"]): string {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
  }
}

export function severityLabel(severity: Issue["severity"]): string {
  switch (severity) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
  }
}
