"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { requestSwap } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import type { Booking } from "@/lib/types"
import { format, parseISO } from "date-fns"
import { usePlatformStore } from "@/lib/data/platform-store"
import {
  SWAP_REASON_MAX,
  findCounterpartyBooking,
} from "@/lib/booking/swap-rules"
import { getSession } from "@/lib/auth/session"
import { SwapCartRoute } from "@/components/swap-cart-route"

export function SwapRequestDialog({
  booking,
  onClose,
}: {
  booking: Booking
  onClose: () => void
}) {
  const router = useRouter()
  const platform = usePlatformStore()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const session = getSession()
  const targetCart = platform.carts.find((c) => c.id === booking.cartId)
  const counterparty = useMemo(() => {
    if (!session?.id) return undefined
    return findCounterpartyBooking(
      platform.bookings,
      session.id,
      booking.date,
      booking.period,
      booking.id,
    )
  }, [session?.id, platform.bookings, booking.date, booking.period, booking.id])

  const myCart = counterparty
    ? platform.carts.find((c) => c.id === counterparty.cartId)
    : undefined
  const isExchange = Boolean(counterparty)
  const whenLabel = `${booking.period} · ${format(parseISO(booking.date), "EEE, MMM d")}`

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-md">
        <DialogHeader className="space-y-2 border-b border-border/60 px-5 py-5 text-left sm:px-6">
          <DialogTitle>
            {isExchange ? "Request cart exchange" : "Request cart handoff"}
          </DialogTitle>
          <DialogDescription>
            {isExchange ? (
              <>
                You and {booking.teacherName} keep your own class details —
                only the carts move for this period.
              </>
            ) : (
              <>
                Ask {booking.teacherName} to give you this slot. You do not have
                a cart this period, so this is a one-way handoff.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/50 bg-neutral-50/60 px-5 py-4 sm:px-6">
          <SwapCartRoute
            mode={isExchange ? "exchange" : "handoff"}
            meta={whenLabel}
            from={{
              eyebrow: isExchange ? "You give" : "You have",
              cartName: isExchange
                ? (myCart?.name ?? "Your cart")
                : "No cart",
              detail: isExchange
                ? counterparty?.className?.trim() ||
                  session?.name ||
                  "Your slot"
                : "This period",
            }}
            to={{
              eyebrow: isExchange ? "You get" : "You want",
              cartName: targetCart?.name ?? "Their cart",
              detail:
                booking.className?.trim() ||
                booking.teacherName ||
                "Their slot",
            }}
          />
        </div>

        <form
          className="flex flex-col gap-5 px-5 py-5 sm:px-6"
          action={(formData) => {
            setError(null)
            formData.set("bookingId", booking.id)
            startTransition(async () => {
              const res = await requestSwap(formData)
              if (res && "error" in res && res.error) {
                setError(res.error)
                return
              }
              toast({
                title: "Swap request sent",
                description: isExchange
                  ? `${myCart?.name ?? "Your cart"} ⇄ ${targetCart?.name ?? "their cart"}`
                  : `Handoff request → ${targetCart?.name ?? "their cart"}`,
              })
              router.refresh()
              onClose()
            })
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reason" className="type-label">
              Reason
            </label>
            <textarea
              id="reason"
              name="reason"
              placeholder={
                isExchange
                  ? "Why you need their cart this period"
                  : "Why you need this slot"
              }
              required
              maxLength={SWAP_REASON_MAX}
              rows={3}
              className="w-full rounded-xl border border-border bg-white p-3 text-[14px] tracking-[-0.011em] text-foreground placeholder:text-muted-foreground outline-none transition focus:border-neutral-400"
            />
            <p className="text-[11px] text-muted-foreground">
              Same day and period only · max {SWAP_REASON_MAX} characters
            </p>
          </div>

          {error ? <p className="type-body text-red-600">{error}</p> : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-foreground px-5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
