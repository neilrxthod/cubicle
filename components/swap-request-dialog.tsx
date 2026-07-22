"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { requestSwap } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import type { Booking } from "@/lib/types"
import { format, parseISO } from "date-fns"

export function SwapRequestDialog({
  booking,
  onClose,
}: {
  booking: Booking
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-136 overflow-hidden rounded-2xl border border-border bg-white p-0">
        <DialogHeader className="gap-3 border-b border-border px-6 py-6 sm:px-7">
          <DialogTitle className="text-[1.45rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Request Swap
          </DialogTitle>
          <DialogDescription className="sr-only">
            Request a swap for this cart booking.
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <span className="rounded-full border border-border bg-white px-2.5 py-1">
              {booking.teacherName}
            </span>
            <span className="rounded-full border border-border bg-white px-2.5 py-1">
              {booking.period}
            </span>
            <span className="rounded-full border border-border bg-white px-2.5 py-1">
              {format(parseISO(booking.date), "EEE, MMM d")}
            </span>
          </div>
        </DialogHeader>

        <form
          className="flex flex-col gap-5 px-6 py-6 sm:px-7"
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
                title: "Request sent", 
                description: `A swap request has been sent to ${booking.teacherName}.` 
              })
              router.refresh()
              onClose()
            })
          }}
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="reason"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Reason for swap
            </label>
            <textarea
              id="reason"
              name="reason"
              placeholder="e.g. I have a special project today and really need this cart."
              required
              rows={4}
              className="w-full rounded-md border border-border bg-white p-3 text-[14px] text-foreground placeholder:text-muted-foreground/65 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-1 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md border border-border bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-black/40 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-10 rounded-md border border-black bg-black px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-black/90 disabled:opacity-60"
            >
              {pending ? "Sending..." : "Send Request"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
