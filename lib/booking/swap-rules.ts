/**
 * Cart swap rules — single source of truth for request / accept / decline.
 *
 * Product model:
 * - Exchange is **same calendar day** (any period the requester already holds).
 * - Requester picks which of their carts to offer when they hold more than one.
 * - Teachers hold **at most one cart per period** — accept checks period conflicts.
 * - **Exchange**: both cells swap people (each keeps class/subject/notes).
 * - **Handoff**: requester offers no cart → owner gives the slot away.
 */

import { addDays, format } from "date-fns";
import type {
  Booking,
  BookingPolicy,
  Cart,
  Period,
  SessionUser,
  SwapRequest,
} from "@/lib/types";
import { PERIODS } from "@/lib/types";

export const SWAP_REASON_MAX = 280;

/** Sent from the request form when the user chooses a pure handoff. */
export const SWAP_OFFER_HANDOFF = "__handoff__";

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

/** Daily cart-slot cap for teachers (admins unlimited). */
function maxSlotsPerDay(policy: BookingPolicy): number {
  return Math.min(5, Math.max(1, policy.maxSlotsPerTeacherPerDay ?? 5));
}

/**
 * Handoff adds one slot on that day. Fail if the teacher is already at the
 * school-wide daily cap set by admins.
 */
function teacherDaySlotCap(
  policy: BookingPolicy,
  currentDayCount: number,
): SwapEvalFail | null {
  const max = maxSlotsPerDay(policy);
  if (currentDayCount >= max) {
    return {
      ok: false,
      error:
        max === 1
          ? "Daily limit is 1 cart slot — cancel another booking or offer an exchange."
          : `Daily limit is ${max} cart slots — cancel another booking or offer an exchange.`,
    };
  }
  return null;
}

const PERIOD_ORDER = new Map(
  PERIODS.map((period, index) => [period as string, index]),
);

function sortByPeriodThenCreated(a: Booking, b: Booking): number {
  const pa = PERIOD_ORDER.get(a.period) ?? 99;
  const pb = PERIOD_ORDER.get(b.period) ?? 99;
  if (pa !== pb) return pa - pb;
  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * Requester's bookings they may offer in exchange for a target slot.
 * Same calendar day only; sorted by period.
 */
export function listOfferableBookings(
  bookings: Booking[],
  requesterId: string,
  target: Booking,
): Booking[] {
  const day = normalizeDate(target.date);
  return bookings
    .filter(
      (b) =>
        b.teacherId === requesterId &&
        normalizeDate(b.date) === day &&
        b.id !== target.id,
    )
    .sort(sortByPeriodThenCreated);
}

/**
 * Default cart to pre-select: same period if the requester has one, else first.
 */
export function defaultOfferedBookingId(
  offerable: Booking[],
  targetPeriod: Period | string,
): string | undefined {
  const samePeriod = offerable.find((b) => b.period === targetPeriod);
  return (samePeriod ?? offerable[0])?.id;
}

/** Resolve the booking offered on a request (explicit id or legacy same-period). */
export function resolveOfferedBooking(
  bookings: Booking[],
  request: Pick<SwapRequest, "requesterId" | "offeredBookingId" | "bookingId">,
  target: Booking,
): Booking | undefined {
  if (request.offeredBookingId) {
    const explicit = bookings.find(
      (b) =>
        b.id === request.offeredBookingId &&
        b.teacherId === request.requesterId,
    );
    if (explicit) return explicit;
  }
  // Legacy requests without offered_booking_id: same day + period.
  return findCounterpartyBooking(
    bookings,
    request.requesterId,
    target.date,
    target.period,
    target.id,
  );
}

/** Requester's other booking on the same date + period (legacy / default). */
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
  matches.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return matches[0];
}

/**
 * After an exchange, neither teacher may end up with two carts in one period.
 */
function periodConflictAfterExchange(
  bookings: Booking[],
  target: Booking,
  offered: Booking,
): string | null {
  // Requester keeps offered.period unless offered.period === target.period (pure swap).
  // After: requester owns target cell (target.period); owner owns offered cell (offered.period).
  if (offered.period !== target.period) {
    const requesterAlreadyOnTargetPeriod = bookings.some(
      (b) =>
        b.teacherId === offered.teacherId &&
        normalizeDate(b.date) === normalizeDate(target.date) &&
        b.period === target.period &&
        b.id !== offered.id &&
        b.id !== target.id,
    );
    if (requesterAlreadyOnTargetPeriod) {
      return "You already have a cart that period. Pick a different cart to offer, or cancel that booking first.";
    }
    const ownerAlreadyOnOfferedPeriod = bookings.some(
      (b) =>
        b.teacherId === target.teacherId &&
        normalizeDate(b.date) === normalizeDate(offered.date) &&
        b.period === offered.period &&
        b.id !== target.id &&
        b.id !== offered.id,
    );
    if (ownerAlreadyOnOfferedPeriod) {
      return "They already have a cart in the period you are offering. Choose another cart.";
    }
  }
  return null;
}

export function swapModeFor(
  bookings: Booking[],
  requesterId: string,
  target: Booking,
  offeredBookingId?: string | null,
): SwapMode {
  if (offeredBookingId && offeredBookingId !== SWAP_OFFER_HANDOFF) {
    return "exchange";
  }
  if (offeredBookingId === SWAP_OFFER_HANDOFF) return "handoff";
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
 * `offeredBookingId` is the requester's cart to give (or SWAP_OFFER_HANDOFF).
 */
export function evaluateSwapRequest(input: {
  session: SessionUser;
  booking: Booking | undefined;
  cart: Cart | undefined;
  bookings: Booking[];
  swaps: SwapRequest[];
  bookingPolicy: BookingPolicy;
  reason: string;
  offeredBookingId?: string | null;
}): SwapEval {
  const {
    session,
    booking,
    cart,
    bookings,
    swaps,
    bookingPolicy,
    reason,
    offeredBookingId,
  } = input;

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

  const offerable = listOfferableBookings(bookings, session.id, booking);
  const rawOffer = (offeredBookingId ?? "").trim();

  // No carts that day → handoff only (still respect daily slot cap).
  if (offerable.length === 0) {
    const handoffCap = teacherDaySlotCap(bookingPolicy, 0);
    if (handoffCap) return handoffCap;
    return { ok: true, mode: "handoff" };
  }

  // Explicit handoff while holding carts that day (allowed).
  if (rawOffer === SWAP_OFFER_HANDOFF || rawOffer === "") {
    // Prefer forcing a selection when they have carts — empty is invalid.
    if (rawOffer === "") {
      return {
        ok: false,
        error: "Select which cart you want to offer, or choose handoff only.",
      };
    }
    const handoffCap = teacherDaySlotCap(bookingPolicy, offerable.length);
    if (handoffCap) return handoffCap;
    return { ok: true, mode: "handoff" };
  }

  const counterparty = offerable.find((b) => b.id === rawOffer);
  if (!counterparty) {
    return {
      ok: false,
      error: "That cart is not available to offer for this swap.",
    };
  }

  const conflict = periodConflictAfterExchange(bookings, booking, counterparty);
  if (conflict) return { ok: false, error: conflict };

  return {
    ok: true,
    mode: "exchange",
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
  bookingPolicy?: BookingPolicy;
}): SwapEval {
  const { session, request, booking, cart, bookings, bookingPolicy } = input;

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

  const counterparty = resolveOfferedBooking(bookings, request, booking);

  if (counterparty) {
    // Offered booking must still belong to the requester.
    if (counterparty.teacherId !== request.requesterId) {
      return {
        ok: false,
        error: "Their offered cart is no longer available. Decline the request.",
      };
    }
    const conflict = periodConflictAfterExchange(
      bookings,
      booking,
      counterparty,
    );
    if (conflict) return { ok: false, error: conflict };
    return { ok: true, mode: "exchange", counterparty };
  }

  // Handoff: requester must not already hold this period (would double-book).
  const already = findCounterpartyBooking(
    bookings,
    request.requesterId,
    booking.date,
    booking.period,
    booking.id,
  );
  if (already) {
    return {
      ok: false,
      error:
        "Requester already has a cart this period — ask them to re-send as an exchange.",
    };
  }

  // Handoff increases the requester's daily slot count.
  if (bookingPolicy) {
    const day = normalizeDate(booking.date);
    const dayCount = bookings.filter(
      (b) =>
        b.teacherId === request.requesterId &&
        normalizeDate(b.date) === day &&
        b.id !== booking.id,
    ).length;
    const cap = teacherDaySlotCap(bookingPolicy, dayCount);
    if (cap) return cap;
  }

  return { ok: true, mode: "handoff" };
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
