/**
 * Apply a Supabase postgres_changes payload to the in-browser platform cache.
 * Used so every open client reflects a write within ~200ms without waiting
 * for a full hydrate.
 */

import { applyRemotePatch } from "@/lib/data/platform-store";
import {
  mapBooking,
  mapBookingPolicy,
  mapCart,
  mapIssue,
  mapProfile,
  mapSlotRestriction,
  mapSwapRequest,
  type DbAllowedEmail,
  type DbBooking,
  type DbBookingPolicy,
  type DbCart,
  type DbIssue,
  type DbProfile,
  type DbSlotRestriction,
  type DbSwapRequest,
} from "@/lib/supabase/mappers";
import { sortCarts } from "@/lib/types";

export type RealtimeChangePayload = {
  eventType?: string;
  table?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

function rowId(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  const id = row.id;
  if (typeof id === "string" && id) return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [item, ...list];
  const next = list.slice();
  next[index] = item;
  return next;
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((entry) => entry.id !== id);
}

export function applyRealtimePostgresChange(
  payload: RealtimeChangePayload,
): void {
  const table = String(payload.table ?? "");
  const event = String(payload.eventType ?? "").toUpperCase();
  const isDelete = event === "DELETE";
  const raw = (isDelete ? payload.old : payload.new) as
    | Record<string, unknown>
    | null
    | undefined;
  if (!table || !event) return;

  try {
    applyRemotePatch((draft) => {
      if (table === "bookings") {
        if (isDelete) {
          const id = rowId(raw);
          if (id) draft.bookings = removeById(draft.bookings, id);
          return;
        }
        if (!raw) return;
        draft.bookings = upsertById(draft.bookings, mapBooking(raw as DbBooking));
        return;
      }

      if (table === "carts") {
        if (isDelete) {
          const id = rowId(raw);
          if (id) draft.carts = removeById(draft.carts, id);
          return;
        }
        if (!raw) return;
        draft.carts = sortCarts(
          upsertById(draft.carts, mapCart(raw as DbCart)),
        );
        return;
      }

      if (table === "issues") {
        if (isDelete) {
          const id = rowId(raw);
          if (id) draft.issues = removeById(draft.issues, id);
          return;
        }
        if (!raw) return;
        draft.issues = upsertById(draft.issues, mapIssue(raw as DbIssue));
        return;
      }

      if (table === "slot_restrictions") {
        if (isDelete) {
          const id = rowId(raw);
          if (id) draft.slotRestrictions = removeById(draft.slotRestrictions, id);
          return;
        }
        if (!raw) return;
        draft.slotRestrictions = upsertById(
          draft.slotRestrictions,
          mapSlotRestriction(raw as DbSlotRestriction),
        );
        return;
      }

      if (table === "swap_requests") {
        if (isDelete) {
          const id = rowId(raw);
          if (id) draft.swapRequests = removeById(draft.swapRequests, id);
          return;
        }
        if (!raw) return;
        draft.swapRequests = upsertById(
          draft.swapRequests,
          mapSwapRequest(raw as DbSwapRequest),
        );
        return;
      }

      if (table === "profiles") {
        if (isDelete) {
          const id = rowId(raw);
          if (id) draft.users = removeById(draft.users, id);
          return;
        }
        if (!raw) return;
        const mapped = mapProfile(raw as DbProfile);
        const existing = draft.users.find((user) => user.id === mapped.id);
        draft.users = upsertById(draft.users, {
          ...mapped,
          password: existing?.password ?? "",
          allowlisted: existing?.allowlisted,
          pendingInvite: existing?.pendingInvite,
        });
        return;
      }

      if (table === "booking_policy") {
        if (isDelete) return;
        draft.bookingPolicy = mapBookingPolicy(
          (raw as DbBookingPolicy | null) ?? null,
        );
        return;
      }

      if (table === "allowed_emails") {
        const email =
          typeof raw?.email === "string" ? raw.email.toLowerCase().trim() : "";
        if (!email) return;
        if (isDelete) {
          draft.users = draft.users.map((user) =>
            user.email.toLowerCase() === email
              ? { ...user, allowlisted: false }
              : user,
          );
          return;
        }
        const allowed = raw as DbAllowedEmail;
        draft.users = draft.users.map((user) => {
          if (user.email.toLowerCase() !== email) return user;
          return {
            ...user,
            allowlisted: true,
            role:
              allowed.role === "admin" || user.role === "admin"
                ? "admin"
                : user.role,
            name: allowed.name?.trim() || user.name,
            employmentType:
              allowed.employment_type === "substitute" ||
              allowed.employment_type === "temporary" ||
              allowed.employment_type === "permanent"
                ? allowed.employment_type
                : user.employmentType,
          };
        });
      }
    });
  } catch (err) {
    console.warn("[cubicle] realtime patch skipped:", err);
  }
}
