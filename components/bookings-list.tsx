"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, isToday, isTomorrow, parseISO } from "date-fns"
import type { Booking, Cart } from "@/lib/types"
import { cancelBooking } from "@/lib/actions"
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
}: {
  title: string
  bookings: Booking[]
  carts: Cart[]
  emptyLabel: string
  emptyAction?: { href: string; label: string }
  canCancel?: boolean
}) {
  const router = useRouter()
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
            const detail = [
              dayLabel(dt),
              b.period,
              b.className?.trim(),
              b.subject?.trim(),
            ]
              .filter(Boolean)
              .join(" · ")

            return (
              <li
                key={b.id}
                className={cn(
                  "flex items-center gap-4 px-4 py-3.5 sm:px-5",
                  i > 0 && "border-t border-[var(--hairline)]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
                    {cart?.name ?? "Cart"}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                    {format(dt, "MMM d, yyyy")} · {detail}
                  </p>
                </div>

                {canCancel ? (
                  <CancelAction
                    bookingId={b.id}
                    onDone={() => router.refresh()}
                  />
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
  onDone,
}: {
  bookingId: string
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await cancelBooking(bookingId)
          if (res && "error" in res && res.error) {
            toast({
              title: "Could not cancel",
              description: res.error,
              variant: "destructive",
            })
            return
          }
          toast({ title: "Canceled" })
          onDone()
        })
      }
      className={cn(
        "shrink-0 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-neutral-400",
        "transition-colors duration-150",
        "hover:bg-neutral-100 hover:text-neutral-950",
        "active:bg-neutral-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {pending ? "…" : "Cancel"}
    </button>
  )
}
