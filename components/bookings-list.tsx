"use client"

import { useTransition } from "react"
import Link from "next/link"
import { format, isToday, isTomorrow, parseISO } from "date-fns"
import { bookingClassLabel } from "@/lib/booking/slot-rules"
import type { Booking, Cart } from "@/lib/types"
import { cancelBooking } from "@/lib/actions"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function dayLabel(date: Date) {
  if (isToday(date)) return "Today"
  if (isTomorrow(date)) return "Tomorrow"
  return format(date, "EEE")
}

export function BookingsList({
  title,
  bookings,
  carts,
  emptyLabel,
  emptyAction,
  canCancel = false,
  /** When set, cancel only shows on bookings this user owns (not share-only). */
  viewerId,
}: {
  title: string
  bookings: Booking[]
  carts: Cart[]
  emptyLabel: string
  emptyAction?: { href: string; label: string }
  canCancel?: boolean
  viewerId?: string
}) {
  const cartMap = new Map(carts.map((c) => [c.id, c]))

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
          {title}
        </h2>
        <span className="text-[12px] tabular-nums text-neutral-400">
          {bookings.length}
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-xl border border-[var(--hairline)] bg-white px-5 py-10 text-center">
          <p className="text-[13px] text-neutral-400">{emptyLabel}</p>
          {emptyAction ? (
            <Link
              href={emptyAction.href}
              className="mt-3 inline-block text-[13px] font-medium text-neutral-950 underline-offset-4 hover:underline"
            >
              {emptyAction.label}
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white">
          {bookings.map((b, i) => {
            const cart = cartMap.get(b.cartId)
            const dt = parseISO(b.date)
            const isSharePartner =
              Boolean(viewerId) && b.sharedWithId === viewerId
            const shareBit = b.sharedWithName?.trim()
              ? isSharePartner
                ? `With ${b.teacherName}`
                : `Shared with ${b.sharedWithName.trim()}`
              : null
            const classLabel = bookingClassLabel(b)
            const subjectLabel = b.subject?.trim()
            const detail = [
              dayLabel(dt),
              b.period,
              classLabel,
              subjectLabel &&
              subjectLabel.toLowerCase() !== "class" &&
              subjectLabel.toLowerCase() !== classLabel.toLowerCase()
                ? subjectLabel
                : null,
              shareBit,
            ]
              .filter(Boolean)
              .join(" · ")

            // Only the booking owner (not share partner) can cancel from this list.
            const showCancel =
              canCancel && (!viewerId || b.teacherId === viewerId)

            return (
              <li
                key={b.id}
                className={cn(
                  "group flex items-center gap-4 px-4 py-3.5 sm:px-5",
                  "transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "hover:bg-black/[0.035] active:bg-black/[0.05]",
                  i > 0 && "border-t border-[var(--hairline)]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
                    {cart?.name ?? "Cart"}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-neutral-400 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-neutral-500">
                    {format(dt, "MMM d, yyyy")} · {detail}
                  </p>
                </div>

                {showCancel ? (
                  <CancelAction bookingId={b.id} />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function CancelAction({
  bookingId,
}: {
  bookingId: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? "Canceling booking" : "Cancel booking"}
      onClick={() =>
        startTransition(async () => {
          const started = Date.now()
          const res = await cancelBooking(bookingId)
          const remain = 1500 - (Date.now() - started)
          if (remain > 0) {
            await new Promise((resolve) => setTimeout(resolve, remain))
          }
          if (res && "error" in res && res.error) {
            toast({
              title: "Could not cancel booking",
              description: res.error,
              variant: "destructive",
            })
            return
          }
          toast({ title: "Booking canceled" })
        })
      }
      className={cn(
        "shrink-0 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium",
        "text-neutral-300 group-hover:text-neutral-400",
        "transition-[color,background-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:bg-red-50 hover:text-red-600",
        "active:bg-red-100/80 active:text-red-700",
        "focus-visible:bg-red-50 focus-visible:text-red-600",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/15",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {pending ? (
        <Spinner className="size-3.5" />
      ) : (
        "Cancel booking"
      )}
    </button>
  )
}
