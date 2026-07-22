"use client";

import { useSyncExternalStore } from "react";
import type { SessionUser } from "@/lib/auth/types";
import { createSeedState } from "./seed";
import type {
  Booking,
  Cart,
  CartStatus,
  CubicleState,
  Issue,
  IssueSeverity,
  IssueStatus,
  PeriodId,
} from "./types";

const STORAGE_KEY = "cubicle_data_v1";
const CHANGE_EVENT = "cubicle_data_change";

let memoryState: CubicleState | null = null;
let cachedRaw: string | null | undefined;

function cloneState(state: CubicleState): CubicleState {
  return structuredClone(state);
}

function readState(): CubicleState {
  if (typeof window === "undefined") {
    return createSeedState();
  }

  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw === cachedRaw && memoryState) {
    return memoryState;
  }

  cachedRaw = raw;

  if (!raw) {
    memoryState = createSeedState();
    return memoryState;
  }

  try {
    const parsed = JSON.parse(raw) as CubicleState;
    memoryState = parsed;
    return memoryState;
  } catch {
    memoryState = createSeedState();
    return memoryState;
  }
}

function writeState(next: CubicleState) {
  memoryState = next;
  const raw = JSON.stringify(next);
  cachedRaw = raw;

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, raw);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function update(mutator: (draft: CubicleState) => void) {
  const draft = cloneState(readState());
  mutator(draft);
  writeState(draft);
}

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function subscribeToCubicle(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getCubicleSnapshot(): CubicleState {
  return readState();
}

export function useCubicleStore(): CubicleState {
  return useSyncExternalStore(
    subscribeToCubicle,
    getCubicleSnapshot,
    createSeedState,
  );
}

export function getCart(state: CubicleState, cartId: string): Cart | undefined {
  return state.carts.find((cart) => cart.id === cartId);
}

export function isCartBookable(cart: Cart): boolean {
  return cart.status === "ready";
}

export function getActiveBookings(state: CubicleState): Booking[] {
  return state.bookings.filter((booking) => booking.status === "confirmed");
}

export function getBookingForSlot(
  state: CubicleState,
  cartId: string,
  date: string,
  periodId: PeriodId,
): Booking | undefined {
  return getActiveBookings(state).find(
    (booking) =>
      booking.cartId === cartId &&
      booking.date === date &&
      booking.periodId === periodId,
  );
}

export function isSlotAvailable(
  state: CubicleState,
  cartId: string,
  date: string,
  periodId: PeriodId,
): boolean {
  const cart = getCart(state, cartId);
  if (!cart || !isCartBookable(cart)) return false;
  return !getBookingForSlot(state, cartId, date, periodId);
}

export function createBooking(input: {
  cartId: string;
  date: string;
  periodId: PeriodId;
  className: string;
  room: string;
  user: SessionUser;
}): { ok: true; booking: Booking } | { ok: false; error: string } {
  const state = readState();
  const cart = getCart(state, input.cartId);

  if (!cart) return { ok: false, error: "Cart not found." };
  if (!isCartBookable(cart)) {
    return { ok: false, error: "This cart is not available for booking." };
  }
  if (!isSlotAvailable(state, input.cartId, input.date, input.periodId)) {
    return { ok: false, error: "That period is already booked." };
  }
  if (!input.className.trim()) {
    return { ok: false, error: "Enter a class name." };
  }

  const booking: Booking = {
    id: id("bk"),
    cartId: input.cartId,
    date: input.date,
    periodId: input.periodId,
    teacherEmail: input.user.email,
    teacherName: input.user.name,
    className: input.className.trim(),
    room: input.room.trim() || "—",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };

  update((draft) => {
    draft.bookings.unshift(booking);
  });

  return { ok: true, booking };
}

export function cancelBooking(
  bookingId: string,
  user: SessionUser,
): { ok: true } | { ok: false; error: string } {
  const state = readState();
  const booking = state.bookings.find((entry) => entry.id === bookingId);

  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.status !== "confirmed") {
    return { ok: false, error: "Booking already cancelled." };
  }
  if (
    user.role !== "admin" &&
    booking.teacherEmail.toLowerCase() !== user.email.toLowerCase()
  ) {
    return { ok: false, error: "You can only cancel your own bookings." };
  }

  update((draft) => {
    const target = draft.bookings.find((entry) => entry.id === bookingId);
    if (target) target.status = "cancelled";
  });

  return { ok: true };
}

export function createIssue(input: {
  cartId: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  user: SessionUser;
}): { ok: true; issue: Issue } | { ok: false; error: string } {
  if (!input.title.trim()) return { ok: false, error: "Add a short title." };
  if (!input.description.trim()) {
    return { ok: false, error: "Describe the issue." };
  }

  const state = readState();
  if (!getCart(state, input.cartId)) {
    return { ok: false, error: "Cart not found." };
  }

  const now = new Date().toISOString();
  const issue: Issue = {
    id: id("iss"),
    cartId: input.cartId,
    reportedByEmail: input.user.email,
    reportedByName: input.user.name,
    title: input.title.trim(),
    description: input.description.trim(),
    severity: input.severity,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  update((draft) => {
    draft.issues.unshift(issue);

    // High severity auto-flags cart for maintenance
    if (input.severity === "high") {
      const cart = draft.carts.find((entry) => entry.id === input.cartId);
      if (cart && cart.status === "ready") {
        cart.status = "maintenance";
        cart.notes = `Auto-flagged: ${issue.title}`;
      }
    }
  });

  return { ok: true, issue };
}

export function updateIssueStatus(
  issueId: string,
  status: IssueStatus,
): { ok: true } | { ok: false; error: string } {
  const state = readState();
  const issue = state.issues.find((entry) => entry.id === issueId);
  if (!issue) return { ok: false, error: "Issue not found." };

  update((draft) => {
    const target = draft.issues.find((entry) => entry.id === issueId);
    if (!target) return;
    target.status = status;
    target.updatedAt = new Date().toISOString();

    if (status === "resolved") {
      const openOnCart = draft.issues.some(
        (entry) =>
          entry.cartId === target.cartId &&
          entry.id !== issueId &&
          entry.status !== "resolved" &&
          entry.severity === "high",
      );
      const cart = draft.carts.find((entry) => entry.id === target.cartId);
      if (cart && !openOnCart && cart.status === "maintenance") {
        cart.status = "ready";
        cart.notes = undefined;
      }
    }
  });

  return { ok: true };
}

export function updateCartStatus(
  cartId: string,
  status: CartStatus,
  notes?: string,
): { ok: true } | { ok: false; error: string } {
  const state = readState();
  if (!getCart(state, cartId)) return { ok: false, error: "Cart not found." };

  update((draft) => {
    const cart = draft.carts.find((entry) => entry.id === cartId);
    if (!cart) return;
    cart.status = status;
    cart.notes = notes?.trim() || undefined;
  });

  return { ok: true };
}

export function resetCubicleData() {
  writeState(createSeedState());
}

export function countOpenIssues(state: CubicleState): number {
  return state.issues.filter((issue) => issue.status !== "resolved").length;
}
