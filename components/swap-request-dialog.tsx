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
                Swap with {booking.teacherName} for the same period: you keep
                your class details, they keep theirs — only the carts move.
                Cross-period trades are not supported.
              </>
            ) : (
              <>
                Ask {booking.teacherName} to give you this slot for the same
                period. You do not have a cart that period, so this is a one-way
                handoff (they lose the slot if they accept).
              </>
            )}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="type-label rounded-full border border-border bg-muted/20 px-2.5 py-1">
              {booking.teacherName}
            </span>
            {targetCart ? (
              <span className="type-label rounded-full border border-border bg-muted/20 px-2.5 py-1">
                {targetCart.name}
              </span>
            ) : null}
            <span className="type-label rounded-full border border-border bg-muted/20 px-2.5 py-1">
              {booking.period}
            </span>
            <span className="type-label rounded-full border border-border bg-muted/20 px-2.5 py-1">
              {format(parseISO(booking.date), "EEE, MMM d")}
            </span>
            {isExchange && myCart ? (
              <span className="type-label rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-900">
                Your {myCart.name} · {counterparty?.period}
              </span>
            ) : null}
          </div>
        </DialogHeader>

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
                  ? `Exchange with ${booking.teacherName}`
                  : `Handoff request to ${booking.teacherName}`,
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
