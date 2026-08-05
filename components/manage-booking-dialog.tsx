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
import { getSessionSnapshot } from "@/lib/auth/session"
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
  const session = getSessionSnapshot()
  const isOwner =
    session?.role === "admin" || booking.teacherId === session?.id
  const isSharePartner = booking.sharedWithId === session?.id

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

  const shareLabel = booking.sharedWithName?.trim() || booking.sharedWithId

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton
        className="w-[min(100%,20rem)] gap-0 overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-white p-0 shadow-[var(--shadow-surface)] sm:max-w-xs"
      >
        <DialogHeader className="space-y-0 px-5 pb-0 pt-5 text-left sm:px-5">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            {isOwner ? "Cancel booking?" : "Shared booking"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {cartName} {booking.period} on {dateLabel}
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

          {shareLabel ? (
            <p className="mt-1 truncate text-[12px] text-neutral-500">
              Shared with{" "}
              <span className="font-medium text-neutral-700">{shareLabel}</span>
              {isSharePartner && !isOwner ? " (you)" : null}
            </p>
          ) : null}

          {notesLabel ? (
            <p className="mt-0.5 line-clamp-2 text-[12px] text-neutral-400">
              {notesLabel}
            </p>
          ) : null}

          <div className="mt-5 flex items-center justify-end gap-3">
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-1 text-[13px] font-medium text-neutral-400 transition-colors hover:text-neutral-900"
                >
                  Keep booking
                </button>
                <AnimatedCancelButton
                  idleLabel="Cancel booking"
                  successLabel="Canceled"
                  size="small"
                  className="min-w-[7.5rem]"
                  onConfirm={() => cancelBooking(booking.id)}
                  onError={(message) => {
                    toast({
                      title: "Could not cancel",
                      description: message,
                      variant: "destructive",
                    })
                  }}
                  onSuccess={() => {
                    toast({ title: "Booking canceled" })
                    router.refresh()
                    onClose()
                  }}
                />
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg bg-neutral-950 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
