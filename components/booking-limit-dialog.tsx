"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { SlotLimitNotice } from "@/lib/booking/slot-rules"

/**
 * Quiet corporate notice when a teacher hits the period or daily cart cap.
 * Toasts are disabled — this is the visible feedback.
 */
export function BookingLimitDialog({
  notice,
  onClose,
}: {
  notice: SlotLimitNotice | null
  onClose: () => void
}) {
  return (
    <Dialog open={notice !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton
        className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-sm"
      >
        <DialogHeader className="space-y-1.5 px-5 pt-5 pb-0 text-left">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            {notice?.title ?? "Limit reached"}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed text-neutral-500">
            {notice?.body}
          </DialogDescription>
        </DialogHeader>
        {notice?.meta ? (
          <p className="px-5 pt-3 text-[12px] tabular-nums tracking-[-0.01em] text-neutral-400">
            {notice.meta}
          </p>
        ) : null}
        <DialogFooter className="flex flex-row items-center justify-end gap-3 px-5 py-5 sm:space-x-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg bg-neutral-950 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            OK
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
