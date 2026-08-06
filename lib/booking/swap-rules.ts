/**
 * Cart swap rules — single source of truth for request / accept / decline.
 *
 * Product model:
 * - Exchange is **same calendar day** (any period the requester already holds).
 * - Requester picks which of their carts to offer when they hold more than one.
 * - Teachers hold **at most two carts per period** — accept checks period caps.
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
import {
  countUserPeriodSlots,
  MAX_CARTS_PER_PERIOD_TEACHER,
} from "@/lib/booking/slot-rules";

export const SWAP_REASON_MAX = 280;

/**
 * Sent from the request form when the user chooses a pure handoff.
 * Prefer plain "handoff" (Radix Select is picky about odd tokens); still accept
 * the legacy "__handoff__" value when reading.
 */
export const SWAP_OFFER_HANDOFF = "handoff";
const HANDOFF_TOKENS = new Set(["handoff", "__handoff__"]);

export function isHandoffOfferId(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return !v || HANDOFF_TOKENS.has(v);
}

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
  return Math.min(15, Math.max(1, policy.maxSlotsPerTeacherPerDay ?? 5));
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

/**
 * Resolve the booking offered on a request.
 * Exchange requests store an explicit `offeredBookingId`.
 * Handoff stores none — do **not** invent a same-period cart (that broke handoff
 * by treating null as an automatic exchange).
 */
export function resolveOfferedBooking(
  bookings: Booking[],
  request: Pick<SwapRequest, "requesterId" | "offeredBookingId" | "bookingId">,
  // Kept for call-site compatibility (list/accept pass the target booking).
  target: Booking,
): Booking | undefined {
  void target;
  const offeredId = request.offeredBookingId?.trim();
  if (isHandoffOfferId(offeredId)) return undefined;

  return bookings.find(
    (b) => b.id === offeredId && b.teacherId === request.requesterId,
  );
}

/** True if user owns, co-shares, or has a pending share invite on this period. */
export function userHoldsPeriod(
  bookings: Booking[],
  userId: string,
  date: string,
  period: string,
  excludeBookingId?: string,
): boolean {
  const day = normalizeDate(date);
  return bookings.some(
    (b) =>
      b.id !== excludeBookingId &&
      normalizeDate(b.date) === day &&
      b.period === period &&
      (b.teacherId === userId ||
        b.sharedWithId === userId ||
        b.sharePendingId === userId),
  );
}

/** How many slots the user is on for a calendar day (owner, share, or pending). */
export function userDaySlotCount(
  bookings: Booking[],
  userId: string,
  date: string,
): number {
  const day = normalizeDate(date);
  return bookings.filter(
    (b) =>
      normalizeDate(b.date) === day &&
      (b.teacherId === userId ||
        b.sharedWithId === userId ||
        b.sharePendingId === userId),
  ).length;
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
 * After an exchange, neither teacher may exceed the per-period cart cap.
 */
function periodConflictAfterExchange(
  bookings: Booking[],
  target: Booking,
  offered: Booking,
): string | null {
  // After: requester owns target cell (target.period); owner owns offered cell (offered.period).
  if (offered.period !== target.period) {
    const requesterOnTarget = countUserPeriodSlots(
      bookings,
      offered.teacherId,
      target.date,
      target.period,
      [offered.id, target.id],
    );
    if (requesterOnTarget >= MAX_CARTS_PER_PERIOD_TEACHER) {
      return `You already have ${MAX_CARTS_PER_PERIOD_TEACHER} carts that period. Pick a different cart to offer, or cancel a booking first.`;
    }
    const ownerOnOffered = countUserPeriodSlots(
      bookings,
      target.teacherId,
      offered.date,
      offered.period,
      [offered.id, target.id],
    );
    if (ownerOnOffered >= MAX_CARTS_PER_PERIOD_TEACHER) {
      return `They already have ${MAX_CARTS_PER_PERIOD_TEACHER} carts in the period you are offering. Choose another cart.`;
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
  if (!isHandoffOfferId(offeredBookingId) && offeredBookingId) {
    return "exchange";
  }
  if (isHandoffOfferId(offeredBookingId) && offeredBookingId) {
    return "handoff";
  }
  // No explicit offer field (legacy): same-period cart ⇒ exchange, else handoff.
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
  const wantsHandoff =
    offerable.length === 0 || isHandoffOfferId(rawOffer);

  // Empty offer with carts still open → force an explicit choice.
  if (offerable.length > 0 && rawOffer === "") {
    return {
      ok: false,
      error: "Select which cart to offer, or choose Handoff.",
    };
  }

  if (wantsHandoff) {
    // Handoff adds a new slot — stay under the per-period cart cap.
    const periodCount = countUserPeriodSlots(
      bookings,
      session.id,
      booking.date,
      booking.period,
      [booking.id],
    );
    if (periodCount >= MAX_CARTS_PER_PERIOD_TEACHER) {
      return {
        ok: false,
        error: `You already have ${MAX_CARTS_PER_PERIOD_TEACHER} carts this period. Offer an exchange instead of a handoff.`,
      };
    }
    // Day cap (owner + shared slots).
    const dayCount = userDaySlotCount(bookings, session.id, booking.date);
    const handoffCap = teacherDaySlotCap(bookingPolicy, dayCount);
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

  // Handoff: requester must stay under the per-period cart cap.
  if (
    countUserPeriodSlots(
      bookings,
      request.requesterId,
      booking.date,
      booking.period,
      [booking.id],
    ) >= MAX_CARTS_PER_PERIOD_TEACHER
  ) {
    return {
      ok: false,
      error: `Requester already has ${MAX_CARTS_PER_PERIOD_TEACHER} carts this period — ask them to re-send as an exchange.`,
    };
  }

  // Handoff increases the requester's daily slot count.
  if (bookingPolicy) {
    const dayCount = userDaySlotCount(
      bookings,
      request.requesterId,
      booking.date,
    );
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
