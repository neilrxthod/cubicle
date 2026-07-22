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
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-amber-700">Swap Requests Received</h2>
        <span className="inline-flex h-6 items-center rounded-full bg-amber-100 px-2 text-[10px] font-bold text-amber-800">
          {requests.length}
        </span>
      </div>

      <div className="grid gap-4">
        {requests.map((req) => {
          const booking = bookingMap.get(req.bookingId)
          if (!booking) return null
          const cart = cartMap.get(booking.cartId)
          
          return (
            <div 
              key={req.id} 
              className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50/50 p-5"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-bold text-foreground">{req.requesterName}</span>
                  <span className="text-[13px] text-muted-foreground">wants to swap for:</span>
                </div>
                <div className="text-[13px] font-medium text-foreground/80">
                  {cart?.name} · {booking.period} · {format(parseISO(booking.date), "MMM d")}
                </div>
              </div>

              <div className="rounded-lg bg-white/80 p-3 text-[13px] italic text-muted-foreground border border-amber-100">
                "{req.reason}"
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    const res = await acceptSwap(req.id)
                    if (res && "error" in res && res.error) {
                      toast({ title: "Error", description: res.error, variant: "destructive" })
                      return
                    }
                    toast({ title: "Swap accepted" })
                    router.refresh()
                  })}
                  className="h-9 rounded-md bg-amber-600 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                >
                  Accept Swap
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    const res = await declineSwap(req.id)
                    if (res && "error" in res && res.error) {
                      toast({ title: "Error", description: res.error, variant: "destructive" })
                      return
                    }
                    toast({ title: "Swap declined" })
                    router.refresh()
                  })}
                  className="h-9 rounded-md border border-border bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-black/40 hover:text-foreground disabled:opacity-60"
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
