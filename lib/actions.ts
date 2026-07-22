"use client";

import { eachDayOfInterval, format, parseISO } from "date-fns";
import { getSession, setSession, clearSession } from "@/lib/auth/session";
import { schoolEmailError } from "@/lib/auth/school-domain";
import {
  getState,
  makeId,
  mutate,
  replaceState,
} from "@/lib/data/platform-store";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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
  dbReportIssue,
  dbRequestSwap,
  dbSetCartStatus,
  dbSyncBookingTeacherName,
  dbUpdateAllowedEmail,
  dbUpdateBookingPolicy,
  dbUpdateIssueStatus,
  dbUpdateProfile,
  dbUpsertRestrictions,
  fetchPlatformState,
  isUuid,
} from "@/lib/supabase/platform-api";
import type {
  CartStatus,
  Period,
  ProfileUpdate,
  RestrictionCategory,
  SessionUser,
} from "@/lib/types";

type Ok<T = undefined> = { ok: true; data?: T; error?: undefined };
type Fail = { ok: false; error: string };
type Result<T = undefined> = Ok<T> | Fail;

function useRemote() {
  return isSupabaseConfigured();
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
  if (!useRemote()) return { ok: true };
  return refreshRemote();
}

function requireSession(): SessionUser | null {
  const session = getSession();
  if (!session) return null;

  const user = getState().users.find(
    (entry) => entry.email.toLowerCase() === session.email.toLowerCase(),
  );

  if (user) {
    return {
      id: user.id.startsWith("pending:") ? session.id ?? user.id : user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? session.avatarUrl,
      title: user.title ?? session.title,
      department: user.department ?? session.department,
      phone: user.phone ?? session.phone,
      bio: user.bio ?? session.bio,
      notifyEmail: user.notifyEmail ?? session.notifyEmail ?? true,
      notifyIssues: user.notifyIssues ?? session.notifyIssues ?? true,
    };
  }

  return {
    id: session.id ?? session.email,
    name: session.name,
    email: session.email,
    role: session.role,
    avatarUrl: session.avatarUrl,
    title: session.title,
    department: session.department,
    phone: session.phone,
    bio: session.bio,
    notifyEmail: session.notifyEmail ?? true,
    notifyIssues: session.notifyIssues ?? true,
  };
}

export async function createBooking(formData: FormData): Promise<Result> {
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

  const restricted = state.slotRestrictions.find(
    (entry) =>
      entry.cartId === cartId &&
      entry.date === date &&
      entry.period === period,
  );
  if (restricted && session.role !== "admin") {
    return { ok: false, error: restricted.reason ?? "Slot is restricted." };
  }

  if (useRemote()) {
    if (!isUuid(session.id)) {
      return {
        ok: false,
        error: "Your account is not linked yet. Sign out and sign in with Google again.",
      };
    }
    const { error } = await dbCreateBooking({
      cartId,
      date,
      period,
      teacherId: session.id,
      teacherName: session.name,
      className: className || "Reserved",
      subject: subject || undefined,
      notes: notes || undefined,
    });
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  mutate((draft) => {
    draft.bookings.unshift({
      id: makeId("bk"),
      cartId,
      date,
      period,
      teacherId: session.id,
      teacherName: session.name,
      className: className || "Reserved",
      subject: subject || undefined,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    });
  });

  return { ok: true };
}

export async function cancelBooking(bookingId: string): Promise<Result> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const booking = getState().bookings.find((entry) => entry.id === bookingId);
  if (!booking) return { ok: false, error: "Booking not found." };
  if (session.role !== "admin" && booking.teacherId !== session.id) {
    return { ok: false, error: "You can only cancel your own bookings." };
  }

  if (useRemote()) {
    const { error } = await dbDeleteBooking(bookingId);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

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

  if (useRemote()) {
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

  if (useRemote()) {
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

export async function setCartStatus(
  cartId: string,
  status: CartStatus,
): Promise<Result> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  if (useRemote()) {
    const { error } = await dbSetCartStatus(cartId, status);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  mutate((draft) => {
    const cart = draft.carts.find((entry) => entry.id === cartId);
    if (cart) cart.status = status;
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

  if (useRemote()) {
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

  if (useRemote()) {
    const { error } = await dbAcceptSwap(request);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  mutate((draft) => {
    const target = draft.bookings.find((entry) => entry.id === request.bookingId);
    const swap = draft.swapRequests.find((entry) => entry.id === requestId);
    if (target && swap) {
      target.teacherId = swap.requesterId;
      target.teacherName = swap.requesterName;
      swap.status = "accepted";
    }
  });

  return { ok: true };
}

export async function declineSwap(requestId: string): Promise<Result> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  if (useRemote()) {
    const { error } = await dbDeclineSwap(requestId);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

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

  if (useRemote()) {
    const { error } = await dbDeleteBookings(bookingIds);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  const ids = new Set(bookingIds);
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

  if (useRemote()) {
    const { error } = await dbReassignBooking(bookingId, cartId);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  mutate((draft) => {
    const target = draft.bookings.find((entry) => entry.id === bookingId);
    if (target) target.cartId = cartId;
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
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  const existing = getState().slotRestrictions.find(
    (entry) =>
      entry.cartId === cartId &&
      entry.date === date &&
      entry.period === period,
  );

  if (useRemote()) {
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
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  let restrictedCount = 0;
  let skippedBookedCount = 0;

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days = eachDayOfInterval({ start, end }).filter((day) => {
    if (!options?.weekdaysOnly) return true;
    const weekday = day.getDay();
    return weekday !== 0 && weekday !== 6;
  });
  const dates = days.map((day) => format(day, "yyyy-MM-dd"));

  if (useRemote()) {
    const state = getState();

    if (action === "available") {
      const { error } = await dbDeleteRestrictionsMatching(
        cartIds,
        dates,
        periods,
      );
      if (error) return { ok: false, error };
      restrictedCount = state.slotRestrictions.filter(
        (entry) =>
          cartIds.includes(entry.cartId) &&
          dates.includes(entry.date) &&
          periods.includes(entry.period),
      ).length;
      const refreshed = await refreshRemote();
      if (!refreshed.ok) return refreshed;
      return { ok: true, data: { restrictedCount, skippedBookedCount } };
    }

    const toInsert: Array<{
      cartId: string;
      date: string;
      period: Period;
      category: RestrictionCategory;
      reason?: string;
    }> = [];

    for (const date of dates) {
      for (const cartId of cartIds) {
        for (const period of periods) {
          const booked = state.bookings.some(
            (booking) =>
              booking.cartId === cartId &&
              booking.date === date &&
              booking.period === period,
          );
          if (booked) {
            skippedBookedCount += 1;
            continue;
          }
          const exists = state.slotRestrictions.some(
            (entry) =>
              entry.cartId === cartId &&
              entry.date === date &&
              entry.period === period,
          );
          if (exists) continue;
          toInsert.push({
            cartId,
            date,
            period,
            category: options?.category ?? "other",
            reason: options?.reason,
          });
        }
      }
    }

    const { error } = await dbUpsertRestrictions(toInsert);
    if (error) return { ok: false, error };
    restrictedCount = toInsert.length;
    const refreshed = await refreshRemote();
    if (!refreshed.ok) return refreshed;
    return { ok: true, data: { restrictedCount, skippedBookedCount } };
  }

  mutate((draft) => {
    for (const day of days) {
      const date = format(day, "yyyy-MM-dd");
      for (const cartId of cartIds) {
        for (const period of periods) {
          const booked = draft.bookings.some(
            (booking) =>
              booking.cartId === cartId &&
              booking.date === date &&
              booking.period === period,
          );
          const existingIndex = draft.slotRestrictions.findIndex(
            (entry) =>
              entry.cartId === cartId &&
              entry.date === date &&
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
          if (existingIndex >= 0) continue;

          draft.slotRestrictions.push({
            id: makeId("sr"),
            cartId,
            date,
            period,
            category: options?.category ?? "other",
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

  if (useRemote()) {
    const { error } = await dbUpdateBookingPolicy(maxAdvanceDays);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

  mutate((draft) => {
    draft.bookingPolicy.maxAdvanceDays = maxAdvanceDays;
  });

  return { ok: true };
}

/**
 * Add a staff member to the Google allowlist (Supabase) or local demo users.
 */
export async function createTeacherCredentials(formData: FormData): Promise<
  Result<{ name: string; email: string; password: string }>
> {
  const session = requireSession();
  if (!session || session.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password =
    String(formData.get("password") ?? "").trim() ||
    `Cubicle${Math.floor(1000 + Math.random() * 9000)}`;

  if (!name || !email) return { ok: false, error: "Name and email required." };

  const domainError = schoolEmailError(email);
  if (domainError) return { ok: false, error: domainError };

  if (useRemote()) {
    if (getState().users.some((user) => user.email === email)) {
      return { ok: false, error: "Email already exists." };
    }
    const { error } = await dbAddAllowedEmail({ email, name, role: "teacher" });
    if (error) return { ok: false, error };
    const refreshed = await refreshRemote();
    if (!refreshed.ok) return refreshed;
    return {
      ok: true,
      data: {
        name,
        email,
        password: "(Google sign-in — no password)",
      },
    };
  }

  if (getState().users.some((user) => user.email === email)) {
    return { ok: false, error: "Email already exists." };
  }

  mutate((draft) => {
    draft.users.push({
      id: makeId("teacher"),
      name,
      email,
      role: "teacher",
      password,
    });
  });

  return { ok: true, data: { name, email, password } };
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

  if (email) {
    const domainError = schoolEmailError(email);
    if (domainError) return { ok: false, error: domainError };
  }

  if (useRemote()) {
    const user = getState().users.find((entry) => entry.id === teacherId);
    if (!user) return { ok: false, error: "Teacher not found." };
    const { error } = await dbUpdateAllowedEmail(user.email, {
      name: name || undefined,
      email: email || undefined,
    });
    if (error) return { ok: false, error };

    // Keep profile in sync when they already signed in
    if (isUuid(teacherId) && name) {
      await dbUpdateProfile(teacherId, {
        name,
        title: user.title,
        department: user.department,
        phone: user.phone,
        bio: user.bio,
        notifyEmail: user.notifyEmail,
        notifyIssues: user.notifyIssues,
      });
    }
    return refreshRemote();
  }

  mutate((draft) => {
    const user = draft.users.find((entry) => entry.id === teacherId);
    if (!user) return;
    if (name) user.name = name;
    if (email) user.email = email;
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

  if (useRemote()) {
    const user = getState().users.find((entry) => entry.id === teacherId);
    if (!user) return { ok: false, error: "Teacher not found." };
    const { error } = await dbDeleteAllowedEmail(user.email);
    if (error) return { ok: false, error };
    return refreshRemote();
  }

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

  if (useRemote()) {
    return {
      ok: false,
      error: "Staff sign in with Google — there is no password to reset.",
    };
  }

  const password = `Cubicle${Math.floor(1000 + Math.random() * 9000)}`;
  let found = false;
  mutate((draft) => {
    const user = draft.users.find((entry) => entry.id === teacherId);
    if (user) {
      user.password = password;
      found = true;
    }
  });

  if (!found) return { ok: false, error: "Teacher not found." };
  return { ok: true, data: { password } };
}

export async function signOutAction() {
  if (typeof window === "undefined") return;

  clearSession();

  // Force fresh platform hydrate on next sign-in (avoid stale user data).
  try {
    const { markPlatformRemoteHydrated } = await import(
      "@/lib/data/platform-store"
    );
    markPlatformRemoteHydrated(false);
  } catch {
    // ignore
  }

  if (useRemote()) {
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

export async function updateProfile(
  input: ProfileUpdate,
): Promise<Result<SessionUser>> {
  const session = requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 80) return { ok: false, error: "Name is too long." };
  if ((input.bio?.length ?? 0) > 280) {
    return { ok: false, error: "Bio must be 280 characters or less." };
  }
  if (input.avatarUrl && input.avatarUrl.length > 900_000) {
    return { ok: false, error: "Photo is too large. Try a smaller image." };
  }

  if (useRemote() && isUuid(session.id)) {
    const { error, data } = await dbUpdateProfile(session.id, input);
    if (error || !data) return { ok: false, error: error ?? "Update failed." };

    await dbSyncBookingTeacherName(session.id, data.name);

    const current = getSession();
    if (current) {
      setSession({
        ...current,
        name: data.name,
        avatarUrl: data.avatarUrl,
        title: data.title,
        department: data.department,
        phone: data.phone,
        bio: data.bio,
        notifyEmail: data.notifyEmail,
        notifyIssues: data.notifyIssues,
      });
    }

    await refreshRemote();
    return { ok: true, data };
  }

  const existing = getState().users.find((entry) => entry.id === session.id);
  if (!existing) return { ok: false, error: "User not found." };

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
    }
    for (const issue of draft.issues) {
      if (issue.reportedById === user.id) {
        issue.reporterName = user.name;
      }
    }
  });

  const saved = getState().users.find((entry) => entry.id === session.id);
  if (!saved) return { ok: false, error: "User not found." };

  const updated: SessionUser = {
    id: saved.id,
    name: saved.name,
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
