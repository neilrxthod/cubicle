"use client";

import { eachDayOfInterval, format, parseISO } from "date-fns";
import { getSession, setSession, clearSession } from "@/lib/auth/session";
import { schoolEmailError } from "@/lib/auth/school-domain";
import {
  clearPlatformBrowserCache,
  forceEmptyPlatformState,
  getState,
  makeId,
  mutate,
  replaceState,
} from "@/lib/data/platform-store";
import { localWriteBlockReason } from "@/lib/data/durability";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { secureRandomInt } from "@/lib/utils";
import {
  dbAcceptSwap,
  dbAddAllowedEmail,
  dbCreateBooking,
  dbDeclineSwap,
  dbDeleteAllowedEmail,
  dbDeleteBooking,
  dbDeleteBookings,
  dbDeleteRestriction,
  dbDeleteRestrictionsMatching,
  dbInsertRestriction,
  dbReassignBooking,
  dbDeleteIssue,
  dbReportIssue,
  dbRequestSwap,
  dbCreateCart,
  dbDeleteCart,
  dbWipeOperationalData,
  dbSetCartStatus,
  dbSyncBookingTeacherName,
  dbSyncLastEditorAvatar,
  dbUpdateAllowedEmail,
  dbUpdateBookingPolicy,
  dbUpdateCart,
  dbUpdateIssueStatus,
  dbUpdateProfile,
  dbUpdateProfileEmployment,
  dbUpsertRestrictions,
  fetchPlatformState,
  isUuid,
} from "@/lib/supabase/platform-api";
import {
  isVerifiedStaff,
  parseEmploymentType,
} from "@/lib/staff/employment";
import { splitDisplayName } from "@/lib/profile/display-name";
import type {
  Booking,
  CartStatus,
  EmploymentType,
  Period,
  ProfileUpdate,
  RestrictionCategory,
  SessionUser,
} from "@/lib/types";
type Ok<T = undefined> = { ok: true; data?: T; error?: undefined };
type Fail = { ok: false; error: string };
type Result<T = undefined> = Ok<T> | Fail;

export type CreateBookingResult = {
  bookingId: string;
  booking?: Booking;
};

function isRemoteEnabled() {
  return isSupabaseConfigured();
}

/** Block localStorage-only mutations when production requires Postgres. */
function assertLocalDemoAllowed(): Result {
  const reason = localWriteBlockReason();
  if (reason) return { ok: false, error: reason };
  return { ok: true };
}

async function refreshRemote(): Promise<Result> {
  try {
    const state = await fetchPlatformState();
    replaceState(state);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to refresh data.",
    };
  }
}

export async function hydratePlatformFromSupabase(): Promise<Result> {
  if (!isRemoteEnabled()) return { ok: true };
  return refreshRemote();
}

/**
 * Explicit admin reset: wipe carts, bookings, issues, restrictions, swaps.
 * Keeps staff profiles / allowlist. Never auto-called on page load.
 */
export async function wipeOperationalData(): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  if (isRemoteEnabled()) {
    const { error } = await dbWipeOperationalData();
    if (error) return { ok: false, error };
    // Refresh from Postgres — do not force-empty first (would drop client profiles mid-session).
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  forceEmptyPlatformState();
  return { ok: true };
}

function requireSession(): SessionUser | null {
  const session = getSession();
  if (!session) return null;

  const user = getState().users.find(
    (entry) => entry.email.toLowerCase() === session.email.toLowerCase(),
  );

  // Never demote a live admin session because allowlist/store lagged as teacher.
  const role =
    session.role === "admin" || user?.role === "admin"
      ? ("admin" as const)
      : (user?.role ?? session.role);

  if (user) {
    return {
      id: user.id.startsWith("pending:") ? session.id ?? user.id : user.id,
      name: user.name,
      firstName: session.firstName,
      lastName: session.lastName,
      email: user.email,
      role,
      avatarUrl: user.avatarUrl ?? session.avatarUrl,
      title: user.title ?? session.title,
      department: user.department ?? session.department,
      phone: user.phone ?? session.phone,
      bio: user.bio ?? session.bio,
      notifyEmail: user.notifyEmail ?? session.notifyEmail ?? true,
      notifyIssues: user.notifyIssues ?? session.notifyIssues ?? true,
      employmentType: user.employmentType ?? session.employmentType,
    };
  }

  return {
    id: session.id ?? session.email,
    name: session.name,
    email: session.email,
    role,
    avatarUrl: session.avatarUrl,
    employmentType: session.employmentType,
    title: session.title,
    department: session.department,
    phone: session.phone,
    bio: session.bio,
    notifyEmail: session.notifyEmail ?? true,
    notifyIssues: session.notifyIssues ?? true,
  };
}

export async function createBooking(
  formData: FormData,
): Promise<Result<CreateBookingResult>> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const cartId = String(formData.get("cartId") ?? "");
  const date = String(formData.get("date") ?? "");
  const period = String(formData.get("period") ?? "") as Period;
  const className = String(formData.get("className") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!cartId || !date || !period) {
    return { ok: false, error: "Missing booking details." };
  }

  const state = getState();
  const cart = state.carts.find((entry) => entry.id === cartId);
  if (!cart) return { ok: false, error: "Cart not found." };
  if (cart.status === "maintenance") {
    return { ok: false, error: "Cart is in maintenance." };
  }

  const conflict = state.bookings.find(
    (booking) =>
      booking.cartId === cartId &&
      booking.date === date &&
      booking.period === period,
  );
  if (conflict) return { ok: false, error: "That slot is already booked." };

  // One cart per teacher per period — prevents double-pulling fleet.
  if (session.role !== "admin") {
    const alreadyThisPeriod = state.bookings.find(
      (booking) =>
        booking.teacherId === session.id &&
        booking.date === date &&
        booking.period === period,
    );
    if (alreadyThisPeriod) {
      return {
        ok: false,
        error:
          "You already have a cart this period. Cancel or reassign that booking first.",
      };
    }
  }

  const restricted = state.slotRestrictions.find(
    (entry) =>
      entry.cartId === cartId &&
      entry.date === date &&
      entry.period === period,
  );
  if (restricted && session.role !== "admin") {
    return { ok: false, error: restricted.reason ?? "Slot is restricted." };
  }

  if (isRemoteEnabled()) {
    if (!isUuid(session.id)) {
      return {
        ok: false,
        error: "Your account is not linked yet. Sign out and sign in with Google again.",
      };
    }
    const { id: remoteId, error } = await dbCreateBooking({
      cartId,
      date,
      period,
      teacherId: session.id,
      teacherName: session.name,
      className: className || undefined,
      subject: subject || undefined,
      notes: notes || undefined,
      lastEditedById: session.id,
      lastEditedByName: session.name,
      lastEditedByAvatarUrl: session.avatarUrl,
    });
    // Always refresh so a lost race shows the other teacher's booking on the board.
    const refreshed = await refreshRemote();
    if (error) return { ok: false, error };
    if (!refreshed.ok) return refreshed;

    const matched =
      (remoteId && getState().bookings.find((b) => b.id === remoteId)) ||
      getState().bookings.find(
        (b) =>
          b.cartId === cartId &&
          b.date === date &&
          b.period === period &&
          b.teacherId === session.id,
      );

    return {
      ok: true,
      data: matched
        ? { bookingId: matched.id, booking: matched }
        : remoteId
          ? { bookingId: remoteId }
          : undefined,
    };
  }

  // Local demo path only (never production without Supabase).
  const demoOk = assertLocalDemoAllowed();
  if (!demoOk.ok) return demoOk;

  let localConflict = false;
  let localBookingId = "";
  mutate((draft) => {
    const taken = draft.bookings.some(
      (booking) =>
        booking.cartId === cartId &&
        booking.date === date &&
        booking.period === period,
    );
    if (taken) {
      localConflict = true;
      return;
    }
    localBookingId = makeId("bk");
    const now = new Date().toISOString();
    draft.bookings.unshift({
      id: localBookingId,
      cartId,
      date,
      period,
      teacherId: session.id,
      teacherName: session.name,
      className: className || undefined,
      subject: subject || undefined,
      notes: notes || undefined,
      createdAt: now,
      lastEditedById: session.id,
      lastEditedByName: session.name,
      lastEditedByAvatarUrl: session.avatarUrl,
      lastEditedAt: now,
    });
  });
  if (localConflict) {
    return { ok: false, error: "That slot is already booked." };
  }

  const localBooking = getState().bookings.find((b) => b.id === localBookingId);
  return {
    ok: true,
    data: localBooking
      ? { bookingId: localBooking.id, booking: localBooking }
      : { bookingId: localBookingId },
  };
}

export async function cancelBooking(bookingId: string): Promise<Result> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const booking = getState().bookings.find((entry) => entry.id === bookingId);
  if (!booking) return { ok: false, error: "Booking not found." };
  if (session.role !== "admin" && booking.teacherId !== session.id) {
    return { ok: false, error: "You can only cancel your own bookings." };
  }

  if (isRemoteEnabled()) {
    const { error } = await dbDeleteBooking(bookingId);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    draft.bookings = draft.bookings.filter((entry) => entry.id !== bookingId);
    draft.swapRequests = draft.swapRequests.filter(
      (entry) => entry.bookingId !== bookingId,
    );
  });

  return { ok: true };
}

export async function reportIssue(formData: FormData): Promise<Result> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const cartId = String(formData.get("cartId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const severity = String(formData.get("severity") ?? "low") as
    | "low"
    | "medium"
    | "high";

  if (!cartId || !description) {
    return { ok: false, error: "Describe the issue." };
  }

  if (isRemoteEnabled()) {
    if (!isUuid(session.id)) {
      return {
        ok: false,
        error: "Your account is not linked yet. Sign out and sign in with Google again.",
      };
    }
    const { error } = await dbReportIssue({
      cartId,
      description,
      severity,
      reportedById: session.id,
      reporterName: session.name,
    });
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    draft.issues.unshift({
      id: makeId("iss"),
      cartId,
      description,
      severity,
      status: "open",
      reportedById: session.id,
      reporterName: session.name,
      createdAt: new Date().toISOString(),
    });
    if (severity === "high") {
      const cart = draft.carts.find((entry) => entry.id === cartId);
      if (cart) cart.status = "maintenance";
    }
  });

  return { ok: true };
}

export async function updateIssueStatus(
  issueId: string,
  status: "open" | "resolved",
): Promise<Result> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const state = getState();
  const issue = state.issues.find((entry) => entry.id === issueId);
  if (!issue) return { ok: false, error: "Issue not found." };

  if (session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  if (isRemoteEnabled()) {
    const { error } = await dbUpdateIssueStatus(issueId, status);
    if (error) return { ok: false, error };

    if (status === "resolved" && issue.severity === "high") {
      const stillOpenHigh = state.issues.some(
        (entry) =>
          entry.id !== issueId &&
          entry.cartId === issue.cartId &&
          entry.status === "open" &&
          entry.severity === "high",
      );
      if (!stillOpenHigh) {
        await dbSetCartStatus(issue.cartId, "active");
      }
    }
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const target = draft.issues.find((entry) => entry.id === issueId);
    if (!target) return;
    target.status = status;

    if (status === "resolved" && target.severity === "high") {
      const stillOpenHigh = draft.issues.some(
        (entry) =>
          entry.id !== issueId &&
          entry.cartId === target.cartId &&
          entry.status === "open" &&
          entry.severity === "high",
      );
      const cart = draft.carts.find((entry) => entry.id === target.cartId);
      if (cart && !stillOpenHigh && cart.status === "maintenance") {
        cart.status = "active";
      }
    }
  });

  return { ok: true };
}

export async function deleteIssue(issueId: string): Promise<Result> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const state = getState();
  const issue = state.issues.find((entry) => entry.id === issueId);
  if (!issue) return { ok: false, error: "Issue not found." };

  const isOwner = issue.reportedById === session.id;
  const isAdmin = session.role === "admin";
  if (!isAdmin && !isOwner) {
    return { ok: false, error: "You can only delete issues you reported." };
  }

  if (isRemoteEnabled()) {
    // Permanent delete in Postgres (issues table). RLS must allow the caller.
    const { error } = await dbDeleteIssue(issueId);
    if (error) return { ok: false, error };

    // Clear maintenance if this was the last open high-severity issue on the cart.
    if (issue.status === "open" && issue.severity === "high") {
      const stillOpenHigh = state.issues.some(
        (entry) =>
          entry.id !== issueId &&
          entry.cartId === issue.cartId &&
          entry.status === "open" &&
          entry.severity === "high",
      );
      if (!stillOpenHigh) {
        await dbSetCartStatus(issue.cartId, "active");
      }
    }

    // Drop from the client cache immediately, then re-sync from Supabase.
    replaceState({
      ...state,
      issues: state.issues.filter((entry) => entry.id !== issueId),
    });
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const idx = draft.issues.findIndex((entry) => entry.id === issueId);
    if (idx < 0) return;
    const target = draft.issues[idx];
    draft.issues.splice(idx, 1);

    if (target.status === "open" && target.severity === "high") {
      const stillOpenHigh = draft.issues.some(
        (entry) =>
          entry.cartId === target.cartId &&
          entry.status === "open" &&
          entry.severity === "high",
      );
      const cart = draft.carts.find((entry) => entry.id === target.cartId);
      if (cart && !stillOpenHigh && cart.status === "maintenance") {
        cart.status = "active";
      }
    }
  });

  return { ok: true };
}

export async function setCartStatus(
  cartId: string,
  status: CartStatus,
): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  if (isRemoteEnabled()) {
    const { error } = await dbSetCartStatus(cartId, status);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const cart = draft.carts.find((entry) => entry.id === cartId);
    if (cart) cart.status = status;
  });

  return { ok: true };
}

function normalizeCartFields(input: {
  name: string;
  location?: string;
  laptopCount?: number | string | null;
}): Result<{ name: string; location: string; laptopCount?: number }> {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Cart name is required." };
  if (name.length > 48) {
    return { ok: false, error: "Name must be 48 characters or fewer." };
  }

  const location = (input.location ?? "").trim().replace(/\s+/g, " ");
  if (!location) return { ok: false, error: "Location is required." };
  if (location.length > 80) {
    return { ok: false, error: "Location must be 80 characters or fewer." };
  }

  let laptopCount: number | undefined;
  if (
    input.laptopCount !== undefined &&
    input.laptopCount !== null &&
    String(input.laptopCount).trim() !== ""
  ) {
    const n = Number(input.laptopCount);
    if (!Number.isInteger(n) || n < 0 || n > 200) {
      return {
        ok: false,
        error: "Laptop count must be a whole number from 0–200.",
      };
    }
    laptopCount = n;
  }

  return {
    ok: true,
    data: {
      name,
      location,
      laptopCount,
    },
  };
}

/** Admin: add a cart to inventory. */
export async function createCart(input: {
  name: string;
  location?: string;
  laptopCount?: number | string | null;
}): Promise<Result<{ cartId: string }>> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  const fields = normalizeCartFields(input);
  if (!fields.ok) {
    return { ok: false, error: fields.error ?? "Invalid cart details." };
  }
  if (!fields.data) {
    return { ok: false, error: "Invalid cart details." };
  }
  const { name, location, laptopCount } = fields.data;

  const duplicate = getState().carts.some(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    return { ok: false, error: "A cart with that name already exists." };
  }

  const id = makeId("cart");

  if (isRemoteEnabled()) {
    const { error } = await dbCreateCart({
      id,
      name,
      location,
      laptopCount,
      status: "active",
    });
    if (error) return { ok: false, error };
    const refreshed = await refreshRemote();
    if (!refreshed.ok) return refreshed;
    return { ok: true, data: { cartId: id } };
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    draft.carts.push({
      id,
      name,
      status: "active",
      location,
      laptopCount,
    });
    draft.carts.sort((a, b) => a.name.localeCompare(b.name));
  });

  return { ok: true, data: { cartId: id } };
}

/** Admin: rename / update cart details. */
export async function updateCart(
  cartId: string,
  input: {
    name: string;
    location?: string;
    laptopCount?: number | string | null;
  },
): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }
  if (!cartId) return { ok: false, error: "Cart not found." };

  const fields = normalizeCartFields(input);
  if (!fields.ok) {
    return { ok: false, error: fields.error ?? "Invalid cart details." };
  }
  if (!fields.data) {
    return { ok: false, error: "Invalid cart details." };
  }
  const { name, location, laptopCount } = fields.data;
  const existing = getState().carts.find((c) => c.id === cartId);
  if (!existing) return { ok: false, error: "Cart not found." };

  const duplicate = getState().carts.some(
    (c) => c.id !== cartId && c.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    return { ok: false, error: "A cart with that name already exists." };
  }

  if (isRemoteEnabled()) {
    const { error } = await dbUpdateCart(cartId, {
      name,
      location,
      laptopCount,
    });
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const cart = draft.carts.find((entry) => entry.id === cartId);
    if (!cart) return;
    cart.name = name;
    cart.location = location;
    cart.laptopCount = laptopCount;
    draft.carts.sort((a, b) => a.name.localeCompare(b.name));
  });

  return { ok: true };
}

/**
 * Admin: permanently remove a cart from inventory.
 * Cascades bookings, issues, restrictions (and swap requests that pointed at those bookings).
 */
export async function deleteCart(cartId: string): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }
  if (!cartId) return { ok: false, error: "Cart not found." };

  const existing = getState().carts.find((c) => c.id === cartId);
  if (!existing) return { ok: false, error: "Cart not found." };

  if (isRemoteEnabled()) {
    const { error } = await dbDeleteCart(cartId);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const bookingIds = new Set(
      draft.bookings
        .filter((b) => b.cartId === cartId)
        .map((b) => b.id),
    );
    draft.bookings = draft.bookings.filter((b) => b.cartId !== cartId);
    draft.issues = draft.issues.filter((i) => i.cartId !== cartId);
    draft.slotRestrictions = draft.slotRestrictions.filter(
      (r) => r.cartId !== cartId,
    );
    draft.swapRequests = draft.swapRequests.filter(
      (s) => !bookingIds.has(s.bookingId),
    );
    draft.carts = draft.carts.filter((c) => c.id !== cartId);
  });

  return { ok: true };
}

export async function requestSwap(formData: FormData): Promise<Result> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const bookingId = String(formData.get("bookingId") ?? "");
  const reason = String(
    formData.get("reason") ?? formData.get("message") ?? "",
  ).trim();
  const booking = getState().bookings.find((entry) => entry.id === bookingId);
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.teacherId === session.id) {
    return { ok: false, error: "You already own this booking." };
  }

  if (isRemoteEnabled()) {
    if (!isUuid(session.id)) {
      return {
        ok: false,
        error: "Your account is not linked yet. Sign out and sign in with Google again.",
      };
    }
    const { error } = await dbRequestSwap({
      bookingId,
      requesterId: session.id,
      requesterName: session.name,
      reason: reason || undefined,
    });
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    draft.swapRequests.unshift({
      id: makeId("sw"),
      bookingId,
      requesterId: session.id,
      requesterName: session.name,
      reason: reason || undefined,
      message: reason || undefined,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  });

  return { ok: true };
}

export async function acceptSwap(requestId: string): Promise<Result> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const state = getState();
  const request = state.swapRequests.find((entry) => entry.id === requestId);
  if (!request || request.status !== "pending") {
    return { ok: false, error: "Request not found." };
  }
  const booking = state.bookings.find((entry) => entry.id === request.bookingId);
  if (!booking) return { ok: false, error: "Booking missing." };
  if (session.role !== "admin" && booking.teacherId !== session.id) {
    return { ok: false, error: "Only the owner can accept." };
  }

  if (isRemoteEnabled()) {
    const { error } = await dbAcceptSwap(request);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const target = draft.bookings.find((entry) => entry.id === request.bookingId);
    const swap = draft.swapRequests.find((entry) => entry.id === requestId);
    if (target && swap) {
      target.teacherId = swap.requesterId;
      target.teacherName = swap.requesterName;
      target.lastEditedById = session.id;
      target.lastEditedByName = session.name;
      target.lastEditedByAvatarUrl = session.avatarUrl;
      target.lastEditedAt = new Date().toISOString();
      swap.status = "accepted";
    }
  });

  return { ok: true };
}

export async function declineSwap(requestId: string): Promise<Result> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  if (isRemoteEnabled()) {
    const { error } = await dbDeclineSwap(requestId);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const swap = draft.swapRequests.find((entry) => entry.id === requestId);
    if (swap) swap.status = "declined";
  });

  return { ok: true };
}

export async function deleteBookings(bookingIds: string[]): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  if (isRemoteEnabled()) {
    const { error } = await dbDeleteBookings(bookingIds);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const ids = new Set(bookingIds);
  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    draft.bookings = draft.bookings.filter((entry) => !ids.has(entry.id));
  });
  return { ok: true };
}

export async function reassignBooking(
  bookingId: string,
  cartId: string,
): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  const state = getState();
  const booking = state.bookings.find((entry) => entry.id === bookingId);
  if (!booking) return { ok: false, error: "Booking not found." };

  const cart = state.carts.find((entry) => entry.id === cartId);
  if (!cart || cart.status !== "active") {
    return { ok: false, error: "Cart unavailable." };
  }

  const conflict = state.bookings.find(
    (entry) =>
      entry.id !== bookingId &&
      entry.cartId === cartId &&
      entry.date === booking.date &&
      entry.period === booking.period,
  );
  if (conflict) return { ok: false, error: "Target cart is already booked." };

  const editor = {
    id: session.id,
    name: session.name,
    avatarUrl: session.avatarUrl,
  };

  if (isRemoteEnabled()) {
    const { error } = await dbReassignBooking(bookingId, cartId, editor);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const target = draft.bookings.find((entry) => entry.id === bookingId);
    if (target) {
      target.cartId = cartId;
      target.lastEditedById = editor.id;
      target.lastEditedByName = editor.name;
      target.lastEditedByAvatarUrl = editor.avatarUrl;
      target.lastEditedAt = new Date().toISOString();
    }
  });

  return { ok: true };
}

export async function toggleSlotRestriction(
  cartId: string,
  date: string,
  period: Period,
  options?: { category?: RestrictionCategory; reason?: string },
): Promise<Result> {
  const session = requireSession();
  const isAdmin =
    session?.role === "admin" || getSession()?.role === "admin";
  if (!session || !isAdmin) {
    return { ok: false, error: "Admin only." };
  }

  const existing = getState().slotRestrictions.find(
    (entry) =>
      entry.cartId === cartId &&
      entry.date === date &&
      entry.period === period,
  );

  if (isRemoteEnabled()) {
    if (existing) {
      const { error } = await dbDeleteRestriction(cartId, date, period);
      if (error) return { ok: false, error };
    } else {
      const { error } = await dbInsertRestriction({
        cartId,
        date,
        period,
        category: options?.category ?? "other",
        reason: options?.reason,
      });
      if (error) return { ok: false, error };
    }
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const existingIndex = draft.slotRestrictions.findIndex(
      (entry) =>
        entry.cartId === cartId &&
        entry.date === date &&
        entry.period === period,
    );
    if (existingIndex >= 0) {
      draft.slotRestrictions.splice(existingIndex, 1);
      return;
    }
    draft.slotRestrictions.push({
      id: makeId("sr"),
      cartId,
      date,
      period,
      category: options?.category ?? "other",
      reason: options?.reason,
    });
  });

  return { ok: true };
}

/** Parse `yyyy-MM-dd` as a local calendar day (avoids UTC shift from parseISO). */
function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

export async function batchRestrictSlots(
  cartIds: string[],
  startDate: string,
  endDate: string,
  periods: Period[],
  action: "restrict" | "available",
  options?: {
    category?: RestrictionCategory;
    reason?: string;
    weekdaysOnly?: boolean;
  },
): Promise<Result<{ restrictedCount: number; skippedBookedCount: number }>> {
  const session = requireSession();
  // Prefer live session role; store profile can lag after promote-to-admin.
  const isAdmin =
    session?.role === "admin" || getSession()?.role === "admin";
  if (!session || !isAdmin) {
    return { ok: false, error: "Admin only." };
  }

  let restrictedCount = 0;
  let skippedBookedCount = 0;

  const uniqueCartIds = Array.from(new Set(cartIds.filter(Boolean)));
  if (uniqueCartIds.length === 0) {
    return { ok: false, error: "No carts selected." };
  }
  if (periods.length === 0) {
    return { ok: false, error: "No periods selected." };
  }

  // Local midnights so "2026-08-13" stays Aug 13 in every timezone.
  const start = parseLocalYmd(startDate);
  const end = parseLocalYmd(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Invalid date range." };
  }
  if (start > end) {
    return { ok: false, error: "Start date must be on or before end date." };
  }

  const days = eachDayOfInterval({ start, end }).filter((day) => {
    if (!options?.weekdaysOnly) return true;
    const weekday = day.getDay();
    return weekday !== 0 && weekday !== 6;
  });
  const dates = days.map((day) => format(day, "yyyy-MM-dd"));
  if (dates.length === 0) {
    return { ok: false, error: "No dates in range." };
  }

  if (isRemoteEnabled()) {
    const state = getState();
    const normalizeDate = (value: string) =>
      value.length >= 10 ? value.slice(0, 10) : value;
    const dateSet = new Set(dates);

    if (action === "available") {
      restrictedCount = state.slotRestrictions.filter(
        (entry) =>
          uniqueCartIds.includes(entry.cartId) &&
          dateSet.has(normalizeDate(entry.date)) &&
          periods.includes(entry.period),
      ).length;
      const { error } = await dbDeleteRestrictionsMatching(
        uniqueCartIds,
        dates,
        periods,
      );
      if (error) return { ok: false, error };

      mutate((draft) => {
        draft.slotRestrictions = draft.slotRestrictions.filter(
          (entry) =>
            !(
              uniqueCartIds.includes(entry.cartId) &&
              dateSet.has(normalizeDate(entry.date)) &&
              periods.includes(entry.period)
            ),
        );
      });

      try {
        await refreshRemote();
      } catch {
        // keep optimistic clear
      }
      return { ok: true, data: { restrictedCount, skippedBookedCount } };
    }

    const toWrite: Array<{
      cartId: string;
      date: string;
      period: Period;
      category: RestrictionCategory;
      reason?: string;
    }> = [];

    const category: RestrictionCategory = options?.category ?? "general";

    for (const date of dates) {
      for (const cartId of uniqueCartIds) {
        for (const period of periods) {
          const booked = state.bookings.some(
            (booking) =>
              booking.cartId === cartId &&
              normalizeDate(booking.date) === date &&
              booking.period === period,
          );
          if (booked) {
            skippedBookedCount += 1;
            continue;
          }
          // Always upsert non-booked slots so re-lock can update type/note.
          toWrite.push({
            cartId,
            date,
            period,
            category,
            reason: options?.reason,
          });
        }
      }
    }

    if (toWrite.length === 0) {
      return {
        ok: true,
        data: { restrictedCount: 0, skippedBookedCount },
      };
    }

    const { error } = await dbUpsertRestrictions(toWrite);
    if (error) return { ok: false, error };
    restrictedCount = toWrite.length;

    // Optimistic local update so the board paints locks immediately even if
    // the follow-up hydrate is slow or fails in local dev.
    mutate((draft) => {
      for (const row of toWrite) {
        const idx = draft.slotRestrictions.findIndex(
          (entry) =>
            entry.cartId === row.cartId &&
            normalizeDate(entry.date) === row.date &&
            entry.period === row.period,
        );
        if (idx >= 0) {
          draft.slotRestrictions[idx] = {
            ...draft.slotRestrictions[idx]!,
            category: row.category,
            reason: row.reason,
            date: row.date,
          };
          continue;
        }
        draft.slotRestrictions.push({
          id: makeId("sr"),
          cartId: row.cartId,
          date: row.date,
          period: row.period,
          category: row.category,
          reason: row.reason,
        });
      }
    });

    // Best-effort rehydrate from Postgres (do not fail the lock if this errors).
    try {
      await refreshRemote();
    } catch {
      // keep optimistic state
    }
    return { ok: true, data: { restrictedCount, skippedBookedCount } };
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  const category: RestrictionCategory = options?.category ?? "general";
  const normalizeDate = (value: string) =>
    value.length >= 10 ? value.slice(0, 10) : value;
  mutate((draft) => {
    for (const day of days) {
      const date = format(day, "yyyy-MM-dd");
      for (const cartId of uniqueCartIds) {
        for (const period of periods) {
          const booked = draft.bookings.some(
            (booking) =>
              booking.cartId === cartId &&
              normalizeDate(booking.date) === date &&
              booking.period === period,
          );
          const existingIndex = draft.slotRestrictions.findIndex(
            (entry) =>
              entry.cartId === cartId &&
              normalizeDate(entry.date) === date &&
              entry.period === period,
          );

          if (action === "available") {
            if (existingIndex >= 0) {
              draft.slotRestrictions.splice(existingIndex, 1);
              restrictedCount += 1;
            }
            continue;
          }

          if (booked) {
            skippedBookedCount += 1;
            continue;
          }
          if (existingIndex >= 0) {
            draft.slotRestrictions[existingIndex] = {
              ...draft.slotRestrictions[existingIndex]!,
              category,
              reason: options?.reason,
              date,
            };
            restrictedCount += 1;
            continue;
          }

          draft.slotRestrictions.push({
            id: makeId("sr"),
            cartId,
            date,
            period,
            category,
            reason: options?.reason,
          });
          restrictedCount += 1;
        }
      }
    }
  });

  return { ok: true, data: { restrictedCount, skippedBookedCount } };
}

export async function updateBookingPolicy(
  maxAdvanceDays: number,
): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  if (isRemoteEnabled()) {
    const { error } = await dbUpdateBookingPolicy(maxAdvanceDays);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    draft.bookingPolicy.maxAdvanceDays = maxAdvanceDays;
  });

  return { ok: true };
}

export type CredentialResult = {
  name: string;
  email: string;
  /** Present only for local demo password logins. */
  password?: string;
  /** True when staff authenticate with school Google (no password). */
  googleSignIn: boolean;
  role: "teacher" | "admin";
  employmentType: EmploymentType;
};

function parseStaffRole(value: FormDataEntryValue | null): "teacher" | "admin" {
  return value === "admin" ? "admin" : "teacher";
}

function isValidEmailShape(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Add staff to the Google allowlist (production) or local demo users.
 */
export async function createTeacherCredentials(
  formData: FormData,
): Promise<Result<CredentialResult>> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = parseStaffRole(formData.get("role"));
  const employmentType = parseEmploymentType(formData.get("employmentType"));
  const password =
    String(formData.get("password") ?? "").trim() ||
    `Cubicle${secureRandomInt(1000, 10000)}`;

  if (!name) return { ok: false, error: "Name is required." };
  if (!email) return { ok: false, error: "Email is required." };
  if (!isValidEmailShape(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  // School domain is enforced in production (Google allowlist). Local demo is open.
  if (isRemoteEnabled()) {
    const domainError = schoolEmailError(email);
    if (domainError) return { ok: false, error: domainError };

    const existing = getState().users.find(
      (user) =>
        user.email.toLowerCase() === email && user.allowlisted !== false,
    );
    if (existing) {
      return { ok: false, error: "That email is already on the allowlist." };
    }

    const { error } = await dbAddAllowedEmail({
      email,
      name,
      role,
      employmentType,
    });
    if (error) {
      if (
        error.toLowerCase().includes("duplicate") ||
        error.toLowerCase().includes("unique")
      ) {
        return { ok: false, error: "That email is already on the allowlist." };
      }
      // Column may not exist until employment-type.sql is applied.
      if (error.toLowerCase().includes("employment_type")) {
        return {
          ok: false,
          error:
            "Database missing employment_type. Run supabase/employment-type.sql in the SQL editor.",
        };
      }
      return { ok: false, error };
    }
    const refreshed = await refreshRemote();
    if (!refreshed.ok) return refreshed;
    return {
      ok: true,
      data: {
        name,
        email,
        googleSignIn: true,
        role,
        employmentType,
      },
    };
  }

  if (getState().users.some((user) => user.email.toLowerCase() === email)) {
    return { ok: false, error: "Email already exists." };
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    draft.users.push({
      id: makeId(role === "admin" ? "admin" : "teacher"),
      name,
      email,
      role,
      password,
      employmentType,
      allowlisted: true,
      pendingInvite: false,
    });
  });

  return {
    ok: true,
    data: { name, email, password, googleSignIn: false, role, employmentType },
  };
}

export async function updateTeacherCredentials(
  teacherId: string,
  formData: FormData,
): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = parseStaffRole(formData.get("role"));
  const employmentType = parseEmploymentType(formData.get("employmentType"));

  if (!name) return { ok: false, error: "Name is required." };
  if (!email) return { ok: false, error: "Email is required." };
  if (!isValidEmailShape(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (isRemoteEnabled()) {
    const domainError = schoolEmailError(email);
    if (domainError) return { ok: false, error: domainError };

    const user = getState().users.find((entry) => entry.id === teacherId);
    if (!user) return { ok: false, error: "Staff member not found." };
    if (user.allowlisted === false) {
      return { ok: false, error: "This person is not on the allowlist." };
    }

    const conflict = getState().users.find(
      (entry) =>
        entry.id !== teacherId &&
        entry.email.toLowerCase() === email &&
        entry.allowlisted !== false,
    );
    if (conflict) {
      return { ok: false, error: "That email is already on the allowlist." };
    }

    const { error } = await dbUpdateAllowedEmail(user.email, {
      name,
      email,
      role,
      employmentType,
    });
    if (error) {
      if (error.toLowerCase().includes("employment_type")) {
        return {
          ok: false,
          error:
            "Database missing employment_type. Run supabase/employment-type.sql in the SQL editor.",
        };
      }
      return { ok: false, error };
    }

    // Keep profile in sync when they already signed in (UUID id).
    if (isUuid(teacherId)) {
      await dbUpdateProfile(teacherId, {
        name,
        title: user.title,
        department: user.department,
        phone: user.phone,
        bio: user.bio,
        notifyEmail: user.notifyEmail,
        notifyIssues: user.notifyIssues,
      });
      await dbUpdateProfileEmployment(teacherId, employmentType);
    }
    return refreshRemote();
  }

  let found = false;
  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const user = draft.users.find((entry) => entry.id === teacherId);
    if (!user) return;
    const conflict = draft.users.some(
      (entry) =>
        entry.id !== teacherId && entry.email.toLowerCase() === email,
    );
    if (conflict) return;
    user.name = name;
    user.email = email;
    user.role = role;
    user.employmentType = employmentType;
    found = true;
  });

  if (!found) {
    const conflict = getState().users.some(
      (entry) =>
        entry.id !== teacherId && entry.email.toLowerCase() === email,
    );
    if (conflict) return { ok: false, error: "Email already exists." };
    return { ok: false, error: "Staff member not found." };
  }

  return { ok: true };
}

/**
 * Admin-only: grant or revoke the blue verified badge.
 * Verified = permanent employment (and allowlisted).
 * Revoking sets employment to temporary (keeps sign-in access).
 */
export async function setStaffVerified(
  teacherId: string,
  verified: boolean,
): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  const user = getState().users.find((entry) => entry.id === teacherId);
  if (!user) return { ok: false, error: "Staff member not found." };
  if (user.allowlisted === false) {
    return {
      ok: false,
      error: "Restore access before granting a verified badge.",
    };
  }

  const employmentType: EmploymentType = verified
    ? "permanent"
    : user.employmentType === "substitute"
      ? "substitute"
      : "temporary";

  // Already in desired verified state — no-op success.
  const currentlyVerified = isVerifiedStaff(user);
  if (currentlyVerified === verified) {
    return { ok: true };
  }

  if (isRemoteEnabled()) {
    const { error } = await dbUpdateAllowedEmail(user.email, {
      employmentType,
    });
    if (error) {
      if (error.toLowerCase().includes("employment_type")) {
        return {
          ok: false,
          error:
            "Database missing employment_type. Run supabase/employment-type.sql in the SQL Editor.",
        };
      }
      return { ok: false, error };
    }
    if (isUuid(teacherId)) {
      await dbUpdateProfileEmployment(teacherId, employmentType);
    }
    return refreshRemote();
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const entry = draft.users.find((u) => u.id === teacherId);
    if (entry) entry.employmentType = employmentType;
  });

  return { ok: true };
}

export async function deleteTeacherCredentials(
  teacherId: string,
): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  if (isRemoteEnabled()) {
    const user = getState().users.find((entry) => entry.id === teacherId);
    if (!user) return { ok: false, error: "Staff member not found." };
    if (user.allowlisted === false) {
      return { ok: false, error: "Already removed from the allowlist." };
    }

    // Never remove your own access.
    if (user.email.toLowerCase() === session.email.toLowerCase()) {
      return {
        ok: false,
        error: "You cannot remove your own access.",
      };
    }

    const { error } = await dbDeleteAllowedEmail(user.email);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  if (
    getState().users.find((entry) => entry.id === teacherId)?.email.toLowerCase() ===
    session.email.toLowerCase()
  ) {
    return { ok: false, error: "You cannot remove your own access." };
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    draft.users = draft.users.filter((entry) => entry.id !== teacherId);
  });

  return { ok: true };
}

export async function resetTeacherPassword(
  teacherId: string,
): Promise<Result<{ password: string }>> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  if (isRemoteEnabled()) {
    return {
      ok: false,
      error: "Staff sign in with Google — there is no password to reset.",
    };
  }

  const password = `Cubicle${secureRandomInt(1000, 10000)}`;
  let found = false;
  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const user = draft.users.find((entry) => entry.id === teacherId);
    if (user) {
      user.password = password;
      found = true;
    }
  });

  if (!found) return { ok: false, error: "Staff member not found." };
  return { ok: true, data: { password } };
}

export async function signOutAction() {
  if (typeof window === "undefined") return;

  clearSession();

  // Drop browser cache only — never touches Supabase Postgres.
  // Next sign-in re-hydrates bookings/carts/staff from the database.
  try {
    clearPlatformBrowserCache();
  } catch {
    try {
      const { markPlatformRemoteHydrated } = await import(
        "@/lib/data/platform-store"
      );
      markPlatformRemoteHydrated(false);
    } catch {
      // ignore
    }
  }

  if (isRemoteEnabled()) {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore — local session already cleared
    }
  }

  window.location.href = "/login";
}

/**
 * Permanently delete the signed-in account.
 * Remote: removes allowlist + Auth user (profile cascades).
 * Local demo: drops the user row from the platform store.
 */
export async function deleteAccountAction(): Promise<Result> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Not available." };
  }

  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  if (isRemoteEnabled() && isUuid(session.id)) {
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        return {
          ok: false,
          error: body.error || "Could not delete account.",
        };
      }
    } catch {
      return { ok: false, error: "Could not reach the server. Try again." };
    }

    // Clear local session chrome; auth user is already gone server-side.
    clearSession();
    try {
      clearPlatformBrowserCache();
    } catch {
      // ignore
    }
    window.location.href = "/login?deleted=1";
    return { ok: true };
  }

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;

  mutate((draft) => {
    draft.users = draft.users.filter((entry) => entry.id !== session.id);
    draft.bookings = draft.bookings.filter(
      (booking) => booking.teacherId !== session.id,
    );
    draft.issues = draft.issues.filter(
      (issue) => issue.reportedById !== session.id,
    );
  });

  clearSession();
  try {
    clearPlatformBrowserCache();
  } catch {
    // ignore
  }
  window.location.href = "/login?deleted=1";
  return { ok: true };
}

export async function updateProfile(
  input: ProfileUpdate,
): Promise<Result<SessionUser>> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 80) return { ok: false, error: "Name is too long." };
  // Settings always sends phone as a string (may be ""). Onboarding may omit it.
  if (typeof input.phone === "string") {
    const phone = input.phone.trim();
    if (!phone) {
      return {
        ok: false,
        error:
          "Phone number is required — each classroom teacher has a dedicated number.",
      };
    }
    if (phone.length > 40) {
      return { ok: false, error: "Phone number is too long." };
    }
    input = { ...input, phone };
  }
  if ((input.bio?.length ?? 0) > 280) {
    return { ok: false, error: "Bio must be 280 characters or less." };
  }
  // High-res WebP/JPEG data URLs (~1024²) land under ~1.5MB string length.
  if (input.avatarUrl && input.avatarUrl.length > 1_800_000) {
    return { ok: false, error: "Photo is too large. Try a smaller image." };
  }

  if (isRemoteEnabled() && isUuid(session.id)) {
    const { error, data } = await dbUpdateProfile(session.id, input);
    if (error || !data) return { ok: false, error: error ?? "Update failed." };

    // Fan-out display name everywhere (bookings, issues, swaps, editor labels, allowlist).
    await dbSyncBookingTeacherName(session.id, data.name, {
      email: data.email ?? session.email,
    });

    // Keep denormalized editor faces on the board in sync with the new photo.
    if (input.avatarUrl !== undefined) {
      await dbSyncLastEditorAvatar(
        session.id,
        data.avatarUrl ?? null,
      );
    }

    const nameBits = splitDisplayName(data.name);
    const sessionPatch = {
      name: data.name,
      firstName: nameBits.firstName,
      lastName: nameBits.lastName,
      avatarUrl: data.avatarUrl,
      title: data.title,
      department: data.department,
      phone: data.phone,
      bio: data.bio,
      notifyEmail: data.notifyEmail,
      notifyIssues: data.notifyIssues,
    };

    const current = getSession();
    if (current) {
      setSession({
        ...current,
        ...sessionPatch,
      });
    }

    await refreshRemote();
    // Re-assert session after hydrate so the header never keeps a stale face
    // or name if platform store lagged for a tick.
    const after = getSession();
    if (after && data) {
      setSession({
        ...after,
        ...sessionPatch,
      });
    }
    return { ok: true, data };
  }

  const existing = getState().users.find((entry) => entry.id === session.id);
  if (!existing) return { ok: false, error: "User not found." };

  const __demo = assertLocalDemoAllowed();
  if (!__demo.ok) return __demo;
  mutate((draft) => {
    const user = draft.users.find((entry) => entry.id === session.id);
    if (!user) return;

    user.name = name;
    user.title = input.title?.trim() || undefined;
    user.department = input.department?.trim() || undefined;
    user.phone = input.phone?.trim() || undefined;
    user.bio = input.bio?.trim() || undefined;
    user.notifyEmail = input.notifyEmail ?? true;
    user.notifyIssues = input.notifyIssues ?? true;

    if (input.avatarUrl === null) {
      user.avatarUrl = undefined;
    } else if (typeof input.avatarUrl === "string") {
      user.avatarUrl = input.avatarUrl;
    }

    for (const booking of draft.bookings) {
      if (booking.teacherId === user.id) {
        booking.teacherName = user.name;
      }
      if (booking.lastEditedById === user.id) {
        booking.lastEditedByName = user.name;
        if (input.avatarUrl !== undefined) {
          booking.lastEditedByAvatarUrl =
            input.avatarUrl === null ? undefined : input.avatarUrl;
        }
      }
    }
    for (const issue of draft.issues) {
      if (issue.reportedById === user.id) {
        issue.reporterName = user.name;
      }
    }
    for (const swap of draft.swapRequests) {
      if (swap.requesterId === user.id) {
        swap.requesterName = user.name;
      }
    }
  });

  const saved = getState().users.find((entry) => entry.id === session.id);
  if (!saved) return { ok: false, error: "User not found." };

  const nameBits = splitDisplayName(saved.name);
  const updated: SessionUser = {
    id: saved.id,
    name: saved.name,
    firstName: nameBits.firstName,
    lastName: nameBits.lastName,
    email: saved.email,
    role: saved.role,
    avatarUrl: saved.avatarUrl,
    title: saved.title,
    department: saved.department,
    phone: saved.phone,
    bio: saved.bio,
    notifyEmail: saved.notifyEmail ?? true,
    notifyIssues: saved.notifyIssues ?? true,
  };

  const current = getSession();
  if (current) {
    setSession({
      ...current,
      name: updated.name,
      firstName: updated.firstName,
      lastName: updated.lastName,
      avatarUrl: updated.avatarUrl,
      title: updated.title,
      department: updated.department,
      phone: updated.phone,
      bio: updated.bio,
      notifyEmail: updated.notifyEmail,
      notifyIssues: updated.notifyIssues,
    });
  }

  return { ok: true, data: updated };
}
