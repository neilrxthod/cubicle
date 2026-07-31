"use client"

import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AnimatedCancelButton } from "@/components/animated-cancel-button"
import { cancelBooking } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import type { Booking, Cart } from "@/lib/types"

/**
 * Minimal booking sheet — identity + cancel. No form chrome.
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

  const cartName = cart?.name ?? "Cart"
  const dateLabel = (() => {
    try {
      return format(parseISO(booking.date), "EEE, MMM d")
    } catch {
      return booking.date
    }
  })()

  const classLabel = booking.className?.trim()
  const subjectLabel = booking.subject?.trim()
  const notesLabel = booking.notes?.trim()
  // One soft line only — no field labels
  const detailParts = [
    booking.teacherName?.trim(),
    classLabel,
    subjectLabel,
  ].filter(Boolean)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton
        className="w-[min(100%,20rem)] gap-0 overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-white p-0 shadow-[var(--shadow-surface)] sm:max-w-xs"
      >
        <DialogHeader className="space-y-0 px-5 pb-0 pt-5 text-left sm:px-5">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            Cancel booking?
          </DialogTitle>
          <DialogDescription className="sr-only">
            Cancel {cartName} {booking.period} on {dateLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 pt-3">
          <p className="text-[13px] leading-snug text-neutral-950">
            <span className="font-semibold">{cartName}</span>
            <span className="text-neutral-300"> · </span>
            <span className="font-medium tabular-nums">{booking.period}</span>
            <span className="text-neutral-300"> · </span>
            <span className="text-neutral-500">{dateLabel}</span>
          </p>

          {detailParts.length > 0 ? (
            <p className="mt-1 truncate text-[12px] text-neutral-400">
              {detailParts.join(" · ")}
            </p>
          ) : null}

          {notesLabel ? (
            <p className="mt-0.5 line-clamp-2 text-[12px] text-neutral-400">
              {notesLabel}
            </p>
          ) : null}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-1 text-[13px] font-medium text-neutral-400 transition-colors hover:text-neutral-900"
            >
              Keep
            </button>
            <AnimatedCancelButton
              idleLabel="Cancel"
              successLabel="Done"
              size="small"
              className="min-w-[6.5rem]"
              onConfirm={() => cancelBooking(booking.id)}
              onError={(message) =>
                toast({
                  title: "Could not cancel",
                  description: message,
                  variant: "destructive",
                })
              }
              onSuccess={() => {
                toast({ title: "Canceled" })
                router.refresh()
                onClose()
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
