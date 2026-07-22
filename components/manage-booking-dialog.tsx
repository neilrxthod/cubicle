"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cancelBooking } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import type { Booking, Cart } from "@/lib/types"

/**
 * Booking detail — cancel is explicit, not a surprise one-click on the board.
 */
export function ManageBookingDialog({
  booking,
  cart,
  onClose,
}: {
  booking: Booking
  cart?: Cart
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const classLabel = booking.className?.trim() || "Booking"
  const dateLabel = (() => {
    try {
      return format(parseISO(booking.date), "EEE, MMM d")
    } catch {
      return booking.date
    }
  })()

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-sm">
        <DialogHeader className="space-y-1.5 border-b border-border/60 px-5 py-5 text-left sm:px-6">
          <DialogTitle>{classLabel}</DialogTitle>
          <DialogDescription>
            {cart?.name ?? "Cart"} · {booking.period} · {dateLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
          <dl className="space-y-2.5 rounded-xl border border-border/60 bg-muted/10 px-3.5 py-3">
            <div>
              <dt className="type-label">Teacher</dt>
              <dd className="type-body-strong mt-0.5">{booking.teacherName}</dd>
            </div>
            {booking.subject?.trim() ? (
              <div>
                <dt className="type-label">Subject</dt>
                <dd className="type-body-strong mt-0.5">{booking.subject}</dd>
              </div>
            ) : null}
            {booking.notes?.trim() ? (
              <div>
                <dt className="type-label">Notes</dt>
                <dd className="type-body mt-0.5 text-neutral-700">{booking.notes}</dd>
              </div>
            ) : null}
          </dl>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Keep
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await cancelBooking(booking.id)
                  if (res && "error" in res && res.error) {
                    toast({
                      title: "Could not cancel",
                      description: res.error,
                      variant: "destructive",
                    })
                    return
                  }
                  toast({ title: "Canceled" })
                  router.refresh()
                  onClose()
                })
              }}
              className="h-9 rounded-lg bg-red-600 px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Canceling…" : "Cancel"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
