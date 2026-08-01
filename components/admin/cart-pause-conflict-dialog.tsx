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
import type { Booking, Cart } from "@/lib/types";
import { cn } from "@/lib/utils";

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
) {
  return carts
    .filter((c) => c.status === "active" && c.id !== pausedCartId)
    .filter(
      (c) =>
        !bookings.some(
          (b) =>
            b.id !== booking.id &&
            b.cartId === c.id &&
            b.date === booking.date &&
            b.period === booking.period,
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Screen-lock modal when pausing a cart that still has upcoming bookings.
 * Corporate, minimal rectangle with reassign / cancel actions.
 */
export function CartPauseConflictDialog({
  cart,
  bookings,
  carts,
  onClose,
  onResolvedAndPaused,
}: {
  cart: Cart;
  bookings: Booking[];
  carts: Cart[];
  onClose: () => void;
  onResolvedAndPaused: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pausing, setPausing] = useState(false);
  const [, startTransition] = useTransition();

  const conflicts = useMemo(
    () => futureBookingsForCart(bookings, cart.id),
    [bookings, cart.id],
  );

  const allClear = conflicts.length === 0;

  function runReassign(booking: Booking, toCartId: string) {
    setBusyId(booking.id);
    startTransition(async () => {
      const res = await reassignBooking(booking.id, toCartId);
      setBusyId(null);
      if (!res.ok) {
        toast({
          title: "Could not reassign",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Reassigned",
        description: `${booking.teacherName} · ${booking.period}`,
      });
      onResolvedAndPaused();
    });
  }

  function runCancel(booking: Booking) {
    setBusyId(booking.id);
    startTransition(async () => {
      const res = await cancelBooking(booking.id);
      setBusyId(null);
      if (!res.ok) {
        toast({
          title: "Could not cancel",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Canceled", description: booking.teacherName });
      onResolvedAndPaused();
    });
  }

  function pauseCart() {
    setPausing(true);
    startTransition(async () => {
      const res = await setCartStatus(cart.id, "maintenance");
      setPausing(false);
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
      <div className="absolute inset-0" aria-hidden onClick={onClose} />

      <div
        className={cn(
          "relative z-10 flex w-full max-w-md flex-col overflow-hidden",
          "rounded-2xl border border-[var(--hairline-strong)] bg-white",
          "max-h-[min(32rem,calc(100svh-2rem))]",
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
                Resolve bookings first
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
                {allClear
                  ? `${cart.name} is clear. Pause when ready.`
                  : `${conflicts.length} upcoming on ${cart.name}. Reassign or cancel each.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={pausing || !!busyId}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--hairline)] px-5 py-3 sm:px-6">
          {allClear ? (
            <p className="py-8 text-center text-[13px] text-neutral-400">
              No remaining reservations.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--hairline)]">
              {conflicts.map((booking) => {
                const free = freeCartsForSlot(
                  carts,
                  bookings,
                  booking,
                  cart.id,
                );
                const busy = busyId === booking.id;
                let dateLabel = booking.date;
                try {
                  dateLabel = format(parseISO(booking.date), "MMM d");
                } catch {
                  /* keep iso */
                }

                return (
                  <li key={booking.id} className="py-3.5 first:pt-1 last:pb-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
                          <span className="tabular-nums text-neutral-500">
                            {booking.period}
                          </span>
                          <span className="mx-1.5 text-neutral-300">·</span>
                          {dateLabel}
                          <span className="mx-1.5 text-neutral-300">·</span>
                          <span className="font-normal text-neutral-700">
                            {booking.teacherName}
                          </span>
                        </p>
                      </div>
                      {busy ? (
                        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-neutral-400" />
                      ) : null}
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      <select
                        disabled={busy || free.length === 0}
                        defaultValue=""
                        aria-label={`Reassign ${booking.teacherName}`}
                        onChange={(e) => {
                          const id = e.target.value;
                          if (!id) return;
                          runReassign(booking, id);
                          e.target.value = "";
                        }}
                        className={cn(
                          "h-8 min-w-0 flex-1 rounded-md border border-[var(--hairline-strong)] bg-white px-2.5",
                          "text-[12.5px] text-neutral-800 outline-none",
                          "focus:border-neutral-400",
                          "disabled:cursor-not-allowed disabled:opacity-45",
                        )}
                      >
                        <option value="" disabled>
                          {free.length === 0 ? "No free carts" : "Reassign…"}
                        </option>
                        {free.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runCancel(booking)}
                        className="h-8 shrink-0 rounded-md px-2.5 text-[12.5px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-red-600 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="shrink-0 border-t border-[var(--hairline)] px-5 py-3.5 sm:px-6">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={pausing || !!busyId}
              onClick={onClose}
              className="h-8 rounded-md px-3 text-[12.5px] font-medium text-neutral-400 transition-colors hover:text-neutral-900 disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!allClear || pausing || !!busyId}
              onClick={pauseCart}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3.5",
                "text-[12.5px] font-medium transition-colors",
                allClear
                  ? "bg-neutral-950 text-white hover:bg-neutral-800"
                  : "cursor-not-allowed bg-neutral-100 text-neutral-400",
              )}
            >
              {pausing ? (
                <Loader2 className="size-3.5 animate-spin opacity-70" />
              ) : null}
              Pause cart
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
