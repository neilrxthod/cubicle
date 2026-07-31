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
import { getSessionSnapshot } from "@/lib/auth/session"
import {
  getOnboarding,
  subjectsFromAssignments,
} from "@/lib/onboarding/storage"
import { toast } from "@/hooks/use-toast"
import type { Cart, Period } from "@/lib/types"

/**
 * Minimal confirm book — subject is filled from onboarding when available.
 */
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

  function resolveSubject() {
    const session = getSessionSnapshot()
    if (!session) return ""
    const prefs = getOnboarding(session.id || session.email)
    const subjects = subjectsFromAssignments(prefs.teachingAssignments ?? [])
    const match = (prefs.teachingAssignments ?? []).find(
      (a) => a.subject.trim() && a.periods.includes(period),
    )
    return match?.subject.trim() || subjects[0] || ""
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-xs">
        <DialogHeader className="space-y-0 px-5 pb-0 pt-5 text-left">
          <DialogTitle className="text-[15px] font-light tracking-[-0.02em] text-neutral-950">
            Book {cart.name}?
          </DialogTitle>
          <DialogDescription className="sr-only">
            Book {cart.name} for {period} on {date}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-5 pb-5 pt-4">
          {error ? (
            <p className="type-body text-red-600">{error}</p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-1 text-[13px] font-medium text-neutral-400 transition-colors hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null)
                const formData = new FormData()
                formData.set("cartId", cart.id)
                formData.set("date", date)
                formData.set("period", period)
                formData.set("subject", resolveSubject())
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
                    title: "Booked",
                    description: `${cart.name} · ${period}`,
                  })
                  router.refresh()
                  onClose()
                })
              }}
              className="h-9 rounded-lg bg-foreground px-5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Booking…" : "Book"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
