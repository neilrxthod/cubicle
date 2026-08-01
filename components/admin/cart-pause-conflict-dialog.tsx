"use client";

import { useMemo, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, X } from "lucide-react";
import {
  cancelBooking,
  reassignBooking,
  setCartStatus,
} from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type { Booking, Cart, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Plan =
  | { kind: "reassign"; cartId: string }
  | { kind: "cancel" };

function teacherInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function futureBookingsForCart(bookings: Booking[], cartId: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  return bookings
    .filter((b) => b.cartId === cartId && b.date >= today)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.period.localeCompare(b.period),
    );
}

function freeCartsForSlot(
  carts: Cart[],
  bookings: Booking[],
  booking: Booking,
  pausedCartId: string,
  plans: Record<string, Plan>,
) {
  const claimedByOthers = new Set(
    Object.entries(plans)
      .filter(([id, plan]) => {
        if (id === booking.id || plan.kind !== "reassign") return false;
        const other = bookings.find((b) => b.id === id);
        return (
          !!other &&
          other.date === booking.date &&
          other.period === booking.period
        );
      })
      .map(([, plan]) => (plan as Extract<Plan, { kind: "reassign" }>).cartId),
  );

  return carts
    .filter((c) => c.status === "active" && c.id !== pausedCartId)
    .filter((c) => !claimedByOthers.has(c.id))
    .filter(
      (c) =>
        !bookings.some(
          (b) =>
            b.id !== booking.id &&
            b.cartId === c.id &&
            b.date === booking.date &&
            b.period === booking.period &&
            plans[b.id]?.kind !== "cancel",
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Screen-lock when pausing a cart with upcoming bookings.
 * Stage reassign/cancel per row, then apply everything on Proceed.
 */
export function CartPauseConflictDialog({
  cart,
  bookings,
  carts,
  users,
  onClose,
  onResolvedAndPaused,
}: {
  cart: Cart;
  bookings: Booking[];
  carts: Cart[];
  users: User[];
  onClose: () => void;
  onResolvedAndPaused: () => void;
}) {
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  const conflicts = useMemo(
    () => futureBookingsForCart(bookings, cart.id),
    [bookings, cart.id],
  );

  const userById = useMemo(() => {
    const m = new Map<string, User>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  const userByName = useMemo(() => {
    const m = new Map<string, User>();
    for (const u of users) m.set(u.name.toLowerCase(), u);
    return m;
  }, [users]);

  const allClear = conflicts.length === 0;
  const allPlanned =
    allClear || conflicts.every((b) => plans[b.id] != null);
  const busy = submitting;

  function setReassign(bookingId: string, cartId: string) {
    setPlans((prev) => ({
      ...prev,
      [bookingId]: { kind: "reassign", cartId },
    }));
  }

  function toggleCancel(bookingId: string) {
    setPlans((prev) => {
      const cur = prev[bookingId];
      if (cur?.kind === "cancel") {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      }
      return { ...prev, [bookingId]: { kind: "cancel" } };
    });
  }

  function proceed() {
    if (!allPlanned || busy) return;
    setSubmitting(true);
    startTransition(async () => {
      for (const booking of conflicts) {
        const plan = plans[booking.id];
        if (!plan) continue;

        if (plan.kind === "reassign") {
          const res = await reassignBooking(booking.id, plan.cartId);
          if (!res.ok) {
            setSubmitting(false);
            toast({
              title: "Could not reassign",
              description: res.error,
              variant: "destructive",
            });
            return;
          }
        } else {
          const res = await cancelBooking(booking.id);
          if (!res.ok) {
            setSubmitting(false);
            toast({
              title: "Could not cancel",
              description: res.error,
              variant: "destructive",
            });
            return;
          }
        }
      }

      const res = await setCartStatus(cart.id, "maintenance");
      setSubmitting(false);
      if (res && "error" in res && res.error) {
        toast({
          title: "Could not pause",
          description: res.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: cart.name, description: "Paused" });
      onResolvedAndPaused();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/40 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-conflict-title"
    >
      <div
        className="absolute inset-0"
        aria-hidden
        onClick={busy ? undefined : onClose}
      />

      <div
        className={cn(
          "relative z-10 flex w-full max-w-2xl flex-col overflow-hidden",
          "rounded-2xl border border-[var(--hairline-strong)] bg-white",
          "max-h-[min(34rem,calc(100svh-2rem))]",
          "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-8px_rgba(0,0,0,0.18)]",
        )}
      >
        <header className="shrink-0 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="pause-conflict-title"
                className="text-[15px] font-medium tracking-[-0.02em] text-neutral-950"
              >
                Reassign bookings
              </h2>
              <p className="mt-1 text-[12.5px] leading-snug text-neutral-400">
                {allClear
                  ? `${cart.name} · ready to pause`
                  : `${cart.name} · reassign or cancel each row, then proceed`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto border-t border-[var(--hairline)]">
          {allClear ? (
            <p className="py-10 text-center text-[13px] text-neutral-400">
              Ready
            </p>
          ) : (
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead className="sticky top-0 z-[1] bg-white">
                <tr className="border-b border-[var(--hairline)]">
                  <th className="px-4 py-2.5 text-[11px] font-medium tracking-wide text-neutral-400 sm:px-5">
                    Period
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-medium tracking-wide text-neutral-400">
                    Date
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-medium tracking-wide text-neutral-400">
                    Teacher
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-medium tracking-wide text-neutral-400">
                    Cart
                  </th>
                  <th className="px-3 py-2.5 pr-4 text-right text-[11px] font-medium tracking-wide text-neutral-400 sm:pr-5">
                    <span className="sr-only">Cancel</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((booking) => {
                  const free = freeCartsForSlot(
                    carts,
                    bookings,
                    booking,
                    cart.id,
                    plans,
                  );
                  const plan = plans[booking.id];
                  const canceling = plan?.kind === "cancel";
                  const reassignId =
                    plan?.kind === "reassign" ? plan.cartId : "";

                  const teacher =
                    userById.get(booking.teacherId) ??
                    userByName.get(booking.teacherName.toLowerCase());
                  const avatarUrl = teacher?.avatarUrl;

                  let dateLabel = booking.date;
                  try {
                    dateLabel = format(parseISO(booking.date), "MMM d");
                  } catch {
                    /* keep iso */
                  }

                  return (
                    <tr
                      key={booking.id}
                      className={cn(
                        "border-t border-[var(--hairline)] first:border-t-0",
                        canceling && "bg-red-50/40",
                      )}
                    >
                      <td className="px-4 py-3 align-middle sm:px-5">
                        <span className="text-[12.5px] font-medium tabular-nums text-neutral-700">
                          {booking.period}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className="text-[12.5px] tabular-nums text-neutral-600">
                          {dateLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={avatarUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="size-7 shrink-0 rounded-full object-cover ring-1 ring-black/[0.05]"
                            />
                          ) : (
                            <span
                              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold tracking-wide text-neutral-500 ring-1 ring-black/[0.04]"
                              aria-hidden
                            >
                              {teacherInitials(booking.teacherName)}
                            </span>
                          )}
                          <span className="min-w-0 truncate text-[13px] tracking-[-0.01em] text-neutral-800">
                            {booking.teacherName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="relative w-[8.5rem]">
                          <select
                            disabled={busy || canceling || free.length === 0}
                            value={reassignId}
                            aria-label={`Cart for ${booking.teacherName}`}
                            onChange={(e) => {
                              const id = e.target.value;
                              if (!id) {
                                setPlans((prev) => {
                                  const next = { ...prev };
                                  delete next[booking.id];
                                  return next;
                                });
                                return;
                              }
                              setReassign(booking.id, id);
                            }}
                            className={cn(
                              "h-8 w-full appearance-none rounded-md border border-[var(--hairline-strong)] bg-white",
                              "pl-2.5 pr-7 text-[12.5px] leading-none text-neutral-800 outline-none",
                              "focus:border-neutral-400",
                              "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 disabled:opacity-70",
                              reassignId && "border-neutral-400",
                            )}
                          >
                            <option value="">
                              {free.length === 0 ? "—" : "Cart"}
                            </option>
                            {reassignId &&
                            !free.some((c) => c.id === reassignId) ? (
                              <option value={reassignId}>
                                {carts.find((c) => c.id === reassignId)
                                  ?.name ?? "Cart"}
                              </option>
                            ) : null}
                            {free.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <svg
                            aria-hidden
                            viewBox="0 0 16 16"
                            fill="none"
                            className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-neutral-400"
                          >
                            <path
                              d="M4.75 6.5 8 9.75 11.25 6.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </td>
                      <td className="px-3 py-3 pr-4 text-right align-middle sm:pr-5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => toggleCancel(booking.id)}
                          className={cn(
                            "h-8 rounded-md px-2.5 text-[12.5px] font-medium transition-colors disabled:opacity-40",
                            canceling
                              ? "bg-red-50 text-red-600"
                              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                          )}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="shrink-0 border-t border-[var(--hairline)] px-5 py-3.5 sm:px-6">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="h-8 rounded-md px-3 text-[12.5px] font-medium text-neutral-400 transition-colors hover:text-neutral-900 disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!allPlanned || busy}
              onClick={proceed}
              className={cn(
                "inline-flex h-8 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-md px-3.5",
                "text-[12.5px] font-medium transition-colors",
                allPlanned && !busy
                  ? "bg-neutral-950 text-white hover:bg-neutral-800"
                  : "cursor-not-allowed bg-neutral-100 text-neutral-400",
              )}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin opacity-70" />
              ) : (
                "Proceed"
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
