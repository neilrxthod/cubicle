"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import type { Booking, Cart, SwapRequest } from "@/lib/types"
import { acceptSwap, declineSwap } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"

export function SwapRequestsList({
  requests,
  bookings,
  carts,
}: {
  requests: SwapRequest[]
  bookings: Booking[]
  carts: Cart[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const cartMap = new Map(carts.map((c) => [c.id, c]))
  const bookingMap = new Map(bookings.map((b) => [b.id, b]))

  if (requests.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/40">
      <div className="flex h-10 items-center gap-2 border-b border-amber-200/60 px-4">
        <h2 className="text-[12px] font-semibold tracking-tight text-amber-900">
          Swap requests
        </h2>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-200/80 px-1.5 text-[11px] font-semibold tabular-nums text-amber-900">
          {requests.length}
        </span>
      </div>

      <div className="divide-y divide-amber-200/50">
        {requests.map((req) => {
          const booking = bookingMap.get(req.bookingId)
          if (!booking) return null
          const cart = cartMap.get(booking.cartId)

          return (
            <div
              key={req.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] text-neutral-900">
                  <span className="font-semibold">{req.requesterName}</span>
                  <span className="text-neutral-500"> wants </span>
                  {cart?.name} · {booking.period} ·{" "}
                  {format(parseISO(booking.date), "MMM d")}
                </p>
                {req.reason ? (
                  <p className="mt-0.5 truncate text-[12px] italic text-neutral-500">
                    &ldquo;{req.reason}&rdquo;
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await acceptSwap(req.id)
                      if (res && "error" in res && res.error) {
                        toast({
                          title: "Error",
                          description: res.error,
                          variant: "destructive",
                        })
                        return
                      }
                      toast({ title: "Swap accepted" })
                      router.refresh()
                    })
                  }
                  className="h-8 rounded-full bg-amber-700 px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await declineSwap(req.id)
                      if (res && "error" in res && res.error) {
                        toast({
                          title: "Error",
                          description: res.error,
                          variant: "destructive",
                        })
                        return
                      }
                      toast({ title: "Swap declined" })
                      router.refresh()
                    })
                  }
                  className="h-8 rounded-full border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 transition-colors hover:text-neutral-950 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
