/**
 * Cart swap rules — single source of truth for request / accept / decline.
 *
 * Product model (intentionally narrow so the board stays consistent):
 * - Swaps are **same calendar day + same period only** (never cross-period).
 * - Teachers hold **at most one cart per period** (booking rules enforce this).
 * - **Exchange**: requester already has a cart that period → both cells swap people
 *   (each keeps their class/subject/notes).
 * - **Handoff**: requester has no cart that period → owner gives the slot away.
 * - Cross-period “trade P1 for P2” is not supported (different times; would break
 *   one-cart-per-period and bell schedules).
 */

import { addDays, format } from "date-fns";
import type {
  Booking,
  BookingPolicy,
  Cart,
  SessionUser,
  SwapRequest,
} from "@/lib/types";

export const SWAP_REASON_MAX = 280;

export type SwapMode = "exchange" | "handoff";

export type SwapEvalOk = {
  ok: true;
  mode: SwapMode;
  counterparty?: Booking;
};

export type SwapEvalFail = {
  ok: false;
  error: string;
};

export type SwapEval = SwapEvalOk | SwapEvalFail;

function todayYmd(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function normalizeDate(ymd: string): string {
  return ymd.slice(0, 10);
}

/** Requester's other booking on the same date + period (true cart exchange). */
export function findCounterpartyBooking(
  bookings: Booking[],
  requesterId: string,
  date: string,
  period: string,
  excludeBookingId: string,
): Booking | undefined {
  const day = normalizeDate(date);
  const matches = bookings.filter(
    (b) =>
      b.teacherId === requesterId &&
      normalizeDate(b.date) === day &&
      b.period === period &&
      b.id !== excludeBookingId,
  );
  // Prefer oldest booking if data ever violates one-cart-per-period.
  matches.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return matches[0];
}

export function swapModeFor(
  bookings: Booking[],
  requesterId: string,
  target: Booking,
): SwapMode {
  return findCounterpartyBooking(
    bookings,
    requesterId,
    target.date,
    target.period,
    target.id,
  )
    ? "exchange"
    : "handoff";
}

function pendingDup(
  swaps: SwapRequest[],
  bookingId: string,
  requesterId: string,
): SwapRequest | undefined {
  return swaps.find(
    (s) =>
      s.status === "pending" &&
      s.bookingId === bookingId &&
      s.requesterId === requesterId,
  );
}

/**
 * Validate creating a swap request against live platform state.
 */
export function evaluateSwapRequest(input: {
  session: SessionUser;
  booking: Booking | undefined;
  cart: Cart | undefined;
  bookings: Booking[];
  swaps: SwapRequest[];
  bookingPolicy: BookingPolicy;
  reason: string;
}): SwapEval {
  const { session, booking, cart, bookings, swaps, bookingPolicy, reason } =
    input;

  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.teacherId === session.id) {
    return { ok: false, error: "You already own this booking." };
  }

  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, error: "Add a short reason for the swap." };
  }
  if (trimmed.length > SWAP_REASON_MAX) {
    return {
      ok: false,
      error: `Reason must be ${SWAP_REASON_MAX} characters or fewer.`,
    };
  }

  if (!cart) {
    return { ok: false, error: "Cart not found." };
  }
  if (cart.status === "maintenance") {
    return {
      ok: false,
      error: "That cart is in maintenance and cannot be swapped.",
    };
  }

  const day = normalizeDate(booking.date);
  const today = todayYmd();
  if (day < today && session.role !== "admin") {
    return { ok: false, error: "Cannot request swaps for past dates." };
  }

  const maxAdvance = Math.max(0, bookingPolicy.maxAdvanceDays ?? 14);
  const lastBookable = format(addDays(new Date(), maxAdvance), "yyyy-MM-dd");
  if (day > lastBookable && session.role !== "admin") {
    return {
      ok: false,
      error: `Swaps are limited to ${maxAdvance} day${maxAdvance === 1 ? "" : "s"} ahead.`,
    };
  }

  if (pendingDup(swaps, booking.id, session.id)) {
    return {
      ok: false,
      error: "You already have a pending request for this slot.",
    };
  }

  // Cross-period is not a product feature — counterparty is always same day/period.
  const counterparty = findCounterpartyBooking(
    bookings,
    session.id,
    booking.date,
    booking.period,
    booking.id,
  );

  return {
    ok: true,
    mode: counterparty ? "exchange" : "handoff",
    counterparty,
  };
}

/**
 * Who may accept / decline / cancel a pending request.
 * - accept: booking owner or admin
 * - decline: booking owner or admin (reject)
 * - cancel: requester withdraws their own request
 */
export function swapActionAllowed(
  session: SessionUser,
  request: SwapRequest | undefined,
  booking: Booking | undefined,
): {
  canAccept: boolean;
  canDecline: boolean;
  canCancel: boolean;
  error?: string;
} {
  if (!session) {
    return {
      canAccept: false,
      canDecline: false,
      canCancel: false,
      error: "Sign in required.",
    };
  }
  if (!request || request.status !== "pending") {
    return {
      canAccept: false,
      canDecline: false,
      canCancel: false,
      error: "Request is not pending.",
    };
  }
  if (!booking) {
    return {
      canAccept: false,
      canDecline: false,
      canCancel: request.requesterId === session.id,
      error: "Booking missing — you can cancel this stale request.",
    };
  }

  const isOwner = booking.teacherId === session.id;
  const isRequester = request.requesterId === session.id;
  const isAdmin = session.role === "admin";

  return {
    canAccept: isOwner || isAdmin,
    canDecline: isOwner || isAdmin,
    canCancel: isRequester,
  };
}

/**
 * Extra accept-time checks (cart maintenance, past dates, ownership still valid).
 */
export function evaluateSwapAccept(input: {
  session: SessionUser;
  request: SwapRequest | undefined;
  booking: Booking | undefined;
  cart: Cart | undefined;
  bookings: Booking[];
}): SwapEval {
  const { session, request, booking, cart, bookings } = input;

  if (!request || request.status !== "pending") {
    return { ok: false, error: "Request not found or already closed." };
  }
  if (!booking) return { ok: false, error: "Booking missing." };

  const auth = swapActionAllowed(session, request, booking);
  if (!auth.canAccept) {
    return { ok: false, error: "Only the current slot owner can accept." };
  }

  if (request.requesterId === booking.teacherId) {
    return {
      ok: false,
      error: "Requester already owns this slot — decline the request.",
    };
  }

  if (cart?.status === "maintenance" && session.role !== "admin") {
    return {
      ok: false,
      error: "Cart is in maintenance — cannot complete the swap.",
    };
  }

  const day = normalizeDate(booking.date);
  if (day < todayYmd() && session.role !== "admin") {
    return {
      ok: false,
      error: "Cannot accept swaps for past dates. Decline instead.",
    };
  }

  // Never create a second cart for the requester in this period via handoff.
  const counterparty = findCounterpartyBooking(
    bookings,
    request.requesterId,
    booking.date,
    booking.period,
    booking.id,
  );

  return {
    ok: true,
    mode: counterparty ? "exchange" : "handoff",
    counterparty,
  };
}

/** Pending requests to close after a successful accept (client demo path). */
export function relatedPendingSwapIds(
  swaps: SwapRequest[],
  acceptedId: string,
  bookingIds: string[],
): string[] {
  const set = new Set(bookingIds.filter(Boolean));
  return swaps
    .filter(
      (s) =>
        s.status === "pending" &&
        s.id !== acceptedId &&
        set.has(s.bookingId),
    )
    .map((s) => s.id);
}
