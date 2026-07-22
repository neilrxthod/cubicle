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
import { syncBookingCreated } from "@/lib/calendar/google-calendar"
import { getGoogleCalendarPrefs } from "@/lib/calendar/preferences"
import { toast } from "@/hooks/use-toast"
import type { Booking, Cart, Period } from "@/lib/types"
import { format, parseISO } from "date-fns"

const fieldClass =
  "h-10 w-full rounded-xl border border-border bg-white px-3 text-[14px] tracking-[-0.011em] text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-neutral-400 focus:ring-0"

const areaClass =
  "min-h-[72px] w-full resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-[14px] leading-relaxed tracking-[-0.011em] text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-neutral-400 focus:ring-0"

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
  const [className, setClassName] = useState("")
  const [subject, setSubject] = useState("")
  const [notes, setNotes] = useState("")

  const dateLabel = (() => {
    try {
      return format(parseISO(date), "EEE, MMM d")
    } catch {
      return date
    }
  })()

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-md">
        <DialogHeader className="space-y-1.5 border-b border-border/60 px-5 py-5 text-left sm:px-6">
          <DialogTitle>Book {cart.name}</DialogTitle>
          <DialogDescription>
            {period} · {dateLabel}
            {cart.location ? ` · ${cart.location}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4 px-5 py-5 sm:px-6"
          action={(formData) => {
            setError(null)
            const cls = className.trim()
            if (!cls) {
              setError("Class is required.")
              return
            }
            formData.set("cartId", cart.id)
            formData.set("date", date)
            formData.set("period", period)
            formData.set("className", cls)
            formData.set("subject", subject.trim())
            formData.set("notes", notes.trim())
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

              let calendarNote = ""
              const booking: Booking | undefined =
                res.ok && res.data?.booking
                  ? res.data.booking
                  : res.ok && res.data?.bookingId
                    ? {
                        id: res.data.bookingId,
                        cartId: cart.id,
                        date,
                        period,
                        teacherId: "",
                        teacherName: "",
                        className: className.trim(),
                        subject: subject.trim() || undefined,
                        notes: notes.trim() || undefined,
                        createdAt: new Date().toISOString(),
                      }
                    : undefined

              if (booking) {
                const prefs = getGoogleCalendarPrefs()
                if (prefs.connected && prefs.autoSync) {
                  const sync = await syncBookingCreated({ booking, cart })
                  if (sync.ok && !sync.skipped) {
                    calendarNote = " · added to Google Calendar"
                  } else if (!sync.ok && sync.needsReconnect) {
                    calendarNote = " · calendar reconnect needed"
                  }
                }
              }

              toast({
                title: "Booked",
                description: `${cart.name} · ${period}${calendarNote}`,
              })
              router.refresh()
              onClose()
            })
          }}
        >
          <label className="block space-y-1.5">
            <span className="type-label">
              Class <span className="text-red-500">*</span>
            </span>
            <input
              name="className"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              required
              autoFocus
              maxLength={80}
              placeholder="Biology 10"
              className={fieldClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="type-label">
              Subject <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <input
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={60}
              placeholder="Science"
              className={fieldClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="type-label">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Room or setup"
              className={areaClass}
            />
          </label>

          {error ? (
            <p className="type-body text-red-600">{error}</p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !className.trim()}
              className="h-9 rounded-lg bg-foreground px-5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Booking…" : "Book"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
