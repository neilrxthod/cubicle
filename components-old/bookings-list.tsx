"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import type { Booking, Cart } from "@/lib/types"
import { cancelBooking } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"

export function BookingsList({
  title,
  bookings,
  carts,
  emptyLabel,
  canCancel = false,
}: {
  title: string
  bookings: Booking[]
  carts: Cart[]
  emptyLabel: string
  canCancel?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const cartMap = new Map(carts.map((c) => [c.id, c]))

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-foreground">{title}</h2>
        <span className="inline-flex h-8 items-center rounded-full border border-border bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {bookings.length} total
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-white px-8 py-14 text-[13px] text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <ul className="grid gap-3">
          {bookings.map((b) => {
            const cart = cartMap.get(b.cartId)
            const dt = parseISO(b.date)
            const classLabel = b.className?.trim()
            const subjectLabel = b.subject?.trim()
            return (
              <li
                key={b.id}
                className="grid gap-4 rounded-xl border border-border bg-white px-4 py-4 md:grid-cols-[150px_84px_1fr_auto] md:items-center md:px-5"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold tracking-tight text-foreground">{format(dt, "MMM d, yyyy")}</span>
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {format(dt, "EEEE")}
                  </span>
                </div>
                <span className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
                  {b.period}
                </span>
                <div className="flex flex-col gap-0.5">
                  <div className="text-[14px] leading-relaxed text-foreground">
                    <span className="font-semibold">{cart?.name ?? "Cart"}</span>
                    {classLabel && (
                      <>
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span>{classLabel}</span>
                      </>
                    )}
                    {subjectLabel && (
                      <>
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span>{subjectLabel}</span>
                      </>
                    )}
                  </div>
                  {b.notes && (
                    <span className="text-[12px] text-muted-foreground">Note: {b.notes}</span>
                  )}
                </div>
                {canCancel ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await cancelBooking(b.id)
                        if (res && "error" in res && res.error) {
                          toast({ title: "Could not cancel", description: res.error, variant: "destructive" })
                          return
                        }
                        toast({ title: "Booking canceled" })
                        router.refresh()
                      })
                    }
                    className="h-9 rounded-md border border-black bg-black px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-black/90 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                ) : (
                  <span className="hidden md:block" aria-hidden="true" />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
