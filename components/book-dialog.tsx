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
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-sm">
        <DialogHeader className="space-y-1.5 border-b border-border/60 px-5 py-5 text-left sm:px-6">
          <DialogTitle>Book {cart.name}</DialogTitle>
          <DialogDescription>
            {period} · {date}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4 px-5 py-5 sm:px-6"
          action={(formData) => {
            setError(null)
            formData.set("cartId", cart.id)
            formData.set("date", date)
            formData.set("period", period)
            startTransition(async () => {
              const res = await createBooking(formData)
              if (res && "error" in res && res.error) {
                setError(res.error)
                toast({
                  title: "Could not book",
                  description: res.error,
                  variant: "destructive",
                })
                router.refresh()
                return
              }
              toast({
                title: "Booking confirmed",
                description: `${cart.name} · ${period}`,
              })
              router.refresh()
              onClose()
            })
          }}
        >
          {error ? (
            <p className="type-body text-red-600">{error}</p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-full bg-foreground px-5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Booking…" : "Confirm"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
