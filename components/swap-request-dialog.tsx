"use client"

import { useState, useTransition } from "react"
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
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-md">
        <DialogHeader className="space-y-2 border-b border-border/60 px-5 py-5 text-left sm:px-6">
          <DialogTitle>Request swap</DialogTitle>
          <DialogDescription>
            Ask {booking.teacherName} for this slot.
            {booking.className?.trim()
              ? ` (${booking.className.trim()})`
              : ""}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="type-label rounded-full border border-border bg-muted/20 px-2.5 py-1">
              {booking.teacherName}
            </span>
            <span className="type-label rounded-full border border-border bg-muted/20 px-2.5 py-1">
              {booking.period}
            </span>
            <span className="type-label rounded-full border border-border bg-muted/20 px-2.5 py-1">
              {format(parseISO(booking.date), "EEE, MMM d")}
            </span>
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
                title: "Request sent",
                description: booking.teacherName,
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
              placeholder="Why you need this slot"
              required
              rows={3}
              className="w-full rounded-xl border border-border bg-white p-3 text-[14px] tracking-[-0.011em] text-foreground placeholder:text-muted-foreground outline-none transition focus:border-neutral-400"
            />
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
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
