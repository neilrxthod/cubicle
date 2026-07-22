"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createBooking } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import type { Cart, Period } from "@/lib/types"

export function BookDialog({
  cart,
  period,
  date,
  onClose,
}: {
  cart: Cart
  period: Period
  date: string
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm rounded-2xl bg-white p-4 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-[16px] font-semibold text-foreground">
            Book {cart.name}
          </DialogTitle>
        </DialogHeader>

        <form
          className="mt-4 flex flex-col gap-3"
          action={(formData) => {
            setError(null)
            formData.set("cartId", cart.id)
            formData.set("date", date)
            formData.set("period", period)
            startTransition(async () => {
              const res = await createBooking(formData)
              if (res && "error" in res && res.error) {
                setError(res.error)
                return
              }
              toast({ title: "Booking confirmed", description: `${cart.name} · ${period}` })
              router.refresh()
              onClose()
            })
          }}
        >
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-1.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
            >
              {pending ? "Booking..." : "Confirm"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
