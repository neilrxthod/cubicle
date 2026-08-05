"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import type { Booking, Cart, SwapRequest } from "@/lib/types"
import { acceptSwap, declineSwap } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import { findCounterpartyBooking } from "@/lib/booking/swap-rules"
import { cn } from "@/lib/utils"

export function SwapRequestsList({
  requests,
  bookings,
  carts,
  /** Incoming = owner accept/decline. Outgoing = requester cancel. */
  variant = "incoming",
}: {
  requests: SwapRequest[]
  bookings: Booking[]
  carts: Cart[]
  variant?: "incoming" | "outgoing"
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  const cartMap = new Map(carts.map((c) => [c.id, c]))
  const bookingMap = new Map(bookings.map((b) => [b.id, b]))

  if (requests.length === 0) return null

  const isOutgoing = variant === "outgoing"

  async function run(
    id: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    okTitle: string,
  ) {
    setBusyId(id)
    try {
      const res = await action()
      if (res && "error" in res && res.error) {
        toast({
          title: "Could not update swap",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      toast({ title: okTitle })
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border shadow-[var(--shadow-surface)]",
        isOutgoing
          ? "border-neutral-200 bg-white"
          : "border-amber-200/70 bg-amber-50/40",
      )}
    >
      <div
        className={cn(
          "flex h-10 items-center gap-2 border-b px-4",
          isOutgoing ? "border-neutral-100" : "border-amber-200/50",
        )}
      >
        <h2
          className={cn(
            "text-[12.5px] font-semibold tracking-tight",
            isOutgoing ? "text-neutral-900" : "text-amber-950",
          )}
        >
          {isOutgoing ? "Your swap requests" : "Swap requests"}
        </h2>
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums",
            isOutgoing
              ? "bg-neutral-100 text-neutral-700"
              : "bg-amber-200/70 text-amber-950",
          )}
        >
          {requests.length}
        </span>
      </div>

      <div
        className={cn(
          "divide-y",
          isOutgoing ? "divide-neutral-100" : "divide-amber-200/40",
        )}
      >
        {requests.map((req) => {
          const booking = bookingMap.get(req.bookingId)
          if (!booking) {
            if (!isOutgoing) return null
            return (
              <div
                key={req.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-[13px] text-neutral-500">
                  Slot no longer exists — cancel this request.
                </p>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() =>
                    void run(req.id, () => declineSwap(req.id), "Request cancelled")
                  }
                  className="h-8 shrink-0 rounded-lg border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {busyId === req.id ? "…" : "Cancel request"}
                </button>
              </div>
            )
          }

          const cart = cartMap.get(booking.cartId)
          const counterparty = findCounterpartyBooking(
            bookings,
            req.requesterId,
            booking.date,
            booking.period,
            booking.id,
          )
          const offeredCart = counterparty
            ? cartMap.get(counterparty.cartId)
            : undefined
          const isExchange = Boolean(counterparty)
          const busy = busyId === req.id
          const blocked = busyId !== null

          return (
            <div
              key={req.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] text-neutral-900">
                  {isOutgoing ? (
                    <>
                      <span className="text-neutral-500">Waiting on </span>
                      <span className="font-semibold">
                        {booking.teacherName}
                      </span>
                      <span className="text-neutral-500">
                        {" "}
                        · {cart?.name} · {booking.period} ·{" "}
                        {format(parseISO(booking.date), "MMM d")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">{req.requesterName}</span>
                      <span className="text-neutral-500">
                        {isExchange
                          ? " wants to exchange carts for "
                          : " wants a handoff of "}
                      </span>
                      {cart?.name} · {booking.period} ·{" "}
                      {format(parseISO(booking.date), "MMM d")}
                      {isExchange && offeredCart ? (
                        <span className="text-neutral-500">
                          {" "}
                          (offers {offeredCart.name})
                        </span>
                      ) : null}
                    </>
                  )}
                </p>
                {req.reason ? (
                  <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                    {req.reason}
                  </p>
                ) : null}
                {!isOutgoing ? (
                  <p className="mt-1 text-[11px] text-neutral-400">
                    {isExchange
                      ? "Accept exchanges both carts for this period only."
                      : "Accept gives them this slot (you will not get a cart back)."}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {isOutgoing ? (
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() =>
                      void run(
                        req.id,
                        () => declineSwap(req.id),
                        "Request cancelled",
                      )
                    }
                    className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-950 disabled:opacity-50"
                  >
                    {busy ? "…" : "Cancel request"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() =>
                        void run(
                          req.id,
                          () => acceptSwap(req.id),
                          isExchange ? "Carts exchanged" : "Slot handed off",
                        )
                      }
                      className="h-8 rounded-lg bg-neutral-950 px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {busy
                        ? "…"
                        : isExchange
                          ? "Accept exchange"
                          : "Accept handoff"}
                    </button>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() =>
                        void run(
                          req.id,
                          () => declineSwap(req.id),
                          "Swap declined",
                        )
                      }
                      className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-950 disabled:opacity-50"
                    >
                      {busy ? "…" : "Decline"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
