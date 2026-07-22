"use client";

import type { SessionUser } from "@/lib/auth/types";
import { formatDisplayDate } from "@/lib/cubicle/periods";
import { enrichBooking } from "@/lib/cubicle/selectors";
import { cancelBooking, useCubicleStore } from "@/lib/cubicle/store";
import type { Booking } from "@/lib/cubicle/types";
import { EmptyState, buttonGhostClassName } from "./ui";
import { CartStatusBadge } from "./status";

export function BookingList({
  bookings,
  user,
  emptyTitle = "No bookings",
  emptyDescription,
}: {
  bookings: Booking[];
  user: SessionUser;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const state = useCubicleStore();

  if (bookings.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <ul className="divide-y divide-black/[0.05]">
      {bookings.map((booking) => {
        const { cart, periodLabel } = enrichBooking(state, booking);
        const canCancel =
          user.role === "admin" ||
          booking.teacherEmail.toLowerCase() === user.email.toLowerCase();

        return (
          <li
            key={booking.id}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14.5px] font-medium tracking-[-0.01em] text-neutral-950">
                  {cart?.name ?? "Cart"} · {formatDisplayDate(booking.date)}
                </p>
                {cart ? <CartStatusBadge status={cart.status} /> : null}
              </div>
              <p className="mt-1 text-[13px] text-neutral-500">
                {periodLabel}
              </p>
              <p className="mt-1 text-[13px] text-neutral-500">
                {booking.className}
                {booking.room !== "—" ? ` · Room ${booking.room}` : ""}
                {" · "}
                {booking.teacherName}
              </p>
            </div>

            {canCancel ? (
              <button
                type="button"
                className={buttonGhostClassName}
                onClick={() => {
                  if (confirm("Cancel this booking?")) {
                    cancelBooking(booking.id, user);
                  }
                }}
              >
                Cancel
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
